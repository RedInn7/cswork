"""Author a small, source-audited OA-Master candidate batch.

The immutable MDX pages are inspected as inert text; no upstream solution is
executed. This script writes candidate-only artifacts and never touches the
runtime registry or verified coverage.
"""
from collections import Counter
from itertools import combinations
from pathlib import Path
import hashlib
import json
import random
import re
import subprocess
import sys

import amazon_remaining_h as helper

ROOT = helper.ROOT
OUT = ROOT / 'content/oa-judge'
BATCH = 'saas-companies-high-confidence'
SEED = 20261005
SOURCE_COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW = {
    'canva': ('web/content/docs/companies/canva.mdx', 'ce892cefabda011684483410a709d0a868cc19df'),
    'rippling': ('web/content/docs/companies/rippling.mdx', 'd1a341bf2798e4dc901bcbf151b3e8e1e9e6310d'),
    'walmart': ('web/content/docs/companies/walmart.mdx', 'bcab1f81c13e37601d23915afc600b83d12b0879'),
    'nutanix': ('web/content/docs/companies/nutanix.mdx', 'e456ebadfeb2ed296ead739808d9cdfb76ce876b'),
    'deloitte': ('web/content/docs/companies/deloitte.mdx', '62419bfb711cf0ce870e12af47046e9c7b9ba9c2'),
    'confluent': ('web/content/docs/companies/confluent.mdx', '50e645cfcc72ad720a081c7618eec450a0a8d1d6'),
    'upstart': ('web/content/docs/companies/upstart.mdx', 'a35bd480f3d2513728f29ae2862f5930096164ff'),
    'wayfair': ('web/content/docs/companies/wayfair.mdx', '9a893e6314ef0a0d04fd8243d6f73bfb0ecb67a5'),
    'plaid': ('web/content/docs/companies/plaid.mdx', '9a7830ed91760587f401c8a8f1fbfd79fa6ecc59'),
    'ramp': ('web/content/docs/companies/ramp.mdx', 'b889171abc2e693b513b5d43a65bd4b26fbeb7b2'),
}
RAW_SHA256 = {
    'canva': 'f33502ff9b0846d6d5774086d5ce0fdcc59727f238726add643ef5195f9b3c91',
    'rippling': '09adeb721c0756e87209f7449d61785e481ab98c2606f41f0e1c8f7c97b19395',
    'nutanix': 'b67313bf0d664dc1e53cf562891402fb70490f6819f24ed4e75db56692a15c54',
    'deloitte': '3af02594080adb72f89dc1db2227f014ce99ab4b8bf1729c1d74e541d1e716d7',
    'walmart': 'c26867b810806b5d43348a98f8f3449318a1f833d661014c217046735f79475d',
    'confluent': 'ceca87f4fb034bf477334354e50da934d3732911b07cbef84a142782eb9d166a',
    'wayfair': 'd4f88b2c7915af44c93ae6963dfd30c73fe7fb2ac7a78102977849a9450ae3a7',
    'plaid': 'bb53b53407bfc264cf9a84e4a321debe4e32046e87c95b529348e628dac334ea',
    'ramp': 'dec7dcf6529263eaba62084edad633bff9349f23d7b665d00e38e97dcf2668ad',
    'upstart': '9ed1c784a4842c1698c8d67a7fa44b79bc8cfafc4938604c53d846cc0ce06144',
}


def spec(company, number, title, desc, limits, output, samples, encode, oracle,
         random_case, code, mutants, idea, proof, complexity, bound=1000000):
    return dict(company=company, number=number, title=title, desc=desc,
                limits=limits, output=output, samples=samples, encode=encode,
                oracle=oracle, random=random_case, code=code, mutants=mutants,
                idea=idea, proof=proof, complexity=complexity, bound=bound)


def enc_array(a): return f'{len(a)}\n' + ' '.join(map(str, a)) + '\n'

def order_oracle(a):
    ordered = sorted(a)
    return sum(x != y for x, y in zip(a, ordered))

def order_random(r): return [r.randint(1, 30) for _ in range(r.randint(1, 12))]

def binary_oracle(s):
    answer = 0
    for left in range(len(s)):
        for right in range(left + 1, len(s) + 1):
            part = s[left:right]
            runs = []
            for ch in part:
                if not runs or runs[-1][0] != ch: runs.append([ch, 1])
                else: runs[-1][1] += 1
            if len(runs) == 2 and runs[0][1] == runs[1][1]: answer += 1
    return answer

def binary_random(r): return ''.join(r.choice('01') for _ in range(r.randint(5, 18)))

def min_function_oracle(a):
    shifted = [x - i for i, x in enumerate(a, 1)]
    return min(sum(abs(y - k) for y in shifted)
               for k in range(min(shifted), max(shifted) + 1))

def min_function_random(r): return [r.randint(1, 40) for _ in range(r.randint(1, 9))]

def good_subseq_oracle(word):
    answer = 0
    for mask in range(1, 1 << len(word)):
        counts = Counter(word[i] for i in range(len(word)) if mask >> i & 1)
        if len(set(counts.values())) == 1: answer += 1
    return answer % 1_000_000_007

def word_random(r): return ''.join(r.choice('abcd') for _ in range(r.randint(1, 10)))

def points_encode(points):
    return f'{len(points)}\n' + ''.join(f'{x} {y}\n' for x, y in points)

def mst_oracle(points):
    n = len(points)
    edges = sorted((abs(points[i][0]-points[j][0]) + abs(points[i][1]-points[j][1]), i, j)
                   for i in range(n) for j in range(i+1, n))
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    total = 0
    for weight, a, b in edges:
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb; total += weight
    return total

def points_random(r):
    n = r.randint(1, 8); pts = set()
    while len(pts) < n: pts.add((r.randint(-8, 8), r.randint(-8, 8)))
    return list(pts)

def players_oracle(data):
    k, scores = data
    return sum(1 for s in scores if s > 0 and 1 + sum(t > s for t in scores) <= k)

def players_encode(data): return f'{len(data[1])} {data[0]}\n' + ' '.join(map(str, data[1])) + '\n'
def players_random(r): return r.randint(1, 12), [r.randint(0, 8) for _ in range(r.randint(1, 12))]

def grid_encode(rows): return f'{len(rows)} {len(rows[0])}\n' + '\n'.join(rows) + '\n'

def wayfair_encode(strings): return f'{len(strings)}\n' + '\n'.join(strings) + '\n'

def grid_oracle(rows):
    n, m = len(rows), len(rows[0]); best = n*m
    for mask in range(1 << (n*m)):
        flips = mask.bit_count()
        if flips >= best: continue
        a = [[rows[i][j] for j in range(m)] for i in range(n)]
        for p in range(n*m):
            if mask >> p & 1:
                i, j = divmod(p, m); a[i][j] = 'W' if a[i][j] == 'B' else 'B'
        if all(a[i][j] == a[i][m-1-j] for i in range(n) for j in range(m)) and \
           all(a[i][j] == a[n-1-i][j] for i in range(n) for j in range(m)):
            best = flips
    return best

def grid_random(r):
    n, m = r.randint(1, 3), r.randint(1, 3)
    return [''.join(r.choice('BW') for _ in range(m)) for _ in range(n)]

def strings_encode(data):
    k, strings = data
    return f'{len(strings)} {k}\n' + ''.join(s + '\n' for s in strings)

def buildable_oracle(data):
    k, strings = data; best = 0
    letters = 'abcdefghij'
    for size in range(min(k, 10) + 1):
        for chosen in combinations(letters, size):
            allowed = set(chosen)
            best = max(best, sum(set(s) <= allowed for s in strings))
    return best

def strings_random(r):
    k = r.randint(0, 5)
    return k, [''.join(r.choice('abcdef') for _ in range(r.randint(1, 6)))
               for _ in range(r.randint(1, 10))]

def even_substring_oracle(s):
    best = 0
    for left in range(len(s)):
        counts = Counter()
        for right in range(left, len(s)):
            counts[s[right]] += 1
            if all(v % 2 == 0 for v in counts.values()): best = max(best, right-left+1)
    return best

def even_random(r): return ''.join(r.choice('abcdef') for _ in range(r.randint(1, 15)))

def points_box_oracle(points):
    xs = [p[0] for p in points]; ys = [p[1] for p in points]
    return ' '.join(map(str,(min(xs), min(ys), max(xs)-min(xs), max(ys)-min(ys))))

def points_box_random(r):
    n = r.randint(1, 12)
    return [(r.randint(-20,20), r.randint(-20,20)) for _ in range(n)]

def wrong_digit_oracle(data):
    a, b, given = data
    correct = str(a+b); other = str(given)
    size = max(len(correct), len(other)); correct = correct.zfill(size); other = other.zfill(size)
    for i, (x, y) in enumerate(zip(correct[::-1], other[::-1])):
        if x != y: return i
    return -1

def wrong_digit_encode(data): return ' '.join(map(str, data)) + '\n'
def wrong_digit_random(r): return tuple(r.randint(0, 10**8) for _ in range(3))

def square_oracle(a):
    best = 0
    for l in range(len(a)):
        h = a[l]
        for r in range(l, len(a)):
            h = min(h, a[r]); side = min(h, r-l+1)
            best = max(best, side*side)
    return best

def square_random(r): return [r.randint(1, 15) for _ in range(r.randint(1, 12))]


SPECS = [
spec('canva',2,'Order Check (Backend)','按身高升序排列后，统计原数组中与正确位置不同的学生数量。','n（1≤n≤100000），下一行 n 个身高（1≤height[i]≤10^9）。数值范围来自原题。','输出位置不正确的学生数。',[[1,1,3,3,4,1],[1,1,3,4,1],[1]],enc_array,order_oracle,order_random,
'''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]; b=sorted(a)
    return str(sum(x!=y for x,y in zip(a,b)))
''', [('按是否逆序而非错位计数','sum(x!=y for x,y in zip(a,b))','sum(a[i]>a[i+1] for i in range(n-1))'),('错误地忽略重复值位置','b=sorted(a)','b=sorted(set(a))')], '排序得到目标序列，逐位置比较。','每个位置正确当且仅当其值等于排序后同一位置的值；计数不相等位置即为题目要求。','时间 O(n log n)，空间 O(n)。',bound=1200000),
spec('canva',3,'Counting Binary Substrings (Backend)','统计所有连续子串中恰好由两段组成、两段分别为 0 与 1、且长度相等的子串数量。','一行二进制字符串 s，5≤|s|≤500000；字符仅为 0/1。','输出符合条件的子串数量。',['001101','00110','010101'],lambda s:s+'\n',binary_oracle,binary_random,
'''def solve(raw):
    s=raw.strip(); prev=0; run=0; last=None; ans=0
    for ch in s:
        if ch==last: run+=1
        else: ans+=min(prev,run); prev,run=run,1; last=ch
    return str(ans+min(prev,run))
''', [('用较大段长度计数','min(prev,run)','max(prev,run)'),('漏掉最后相邻段','return str(ans+min(prev,run))','return str(ans)')], '把字符串分成连续相同字符段；每对相邻段贡献两段长度的较小值。','任何合法子串必须恰好跨过一对相邻的不同字符段；跨界起点可选数量为两段长度的较小值。相邻段对不可能重复表示同一子串，求和即答案。','时间 O(n)，额外空间 O(1)。'),
spec('walmart',4,'Minimum Possible Value of Function','给定序列 X，求整数 k 使 Σ|X[i]−(k+i+1)| 最小，并输出最小值。','n（1≤n≤200000），下一行 n 个整数 X[i]（1≤X[i]≤10^9）。','输出函数的最小值，使用整数。',[[2,2,3,5,5],[1],[10,1,10]],enc_array,min_function_oracle,min_function_random,
'''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; y=sorted(v[i+1]-i for i in range(n)); med=y[n//2]
    return str(sum(abs(x-med) for x in y))
''', [('将偏移方向写反','v[i+1]-i','v[i+1]+i'),('取左端而非任一中位数','y[n//2]','y[0]')], '令 y[i]=X[i]−(i+1)，则目标是 Σ|y[i]−k|；取 y 的中位数作为最优 k。','绝对偏差和在中位数处最小。变换后原式逐项等于 |y[i]−k|，所以将中位数代入并求和就是全局最小值。','时间 O(n log n)，额外空间 O(n)。',bound=2500000),
spec('nutanix',1,'Good Subsequences','统计非空子序列中，所有出现字符的频次都相同的子序列数量；按 1,000,000,007 取模。相同字符来自不同下标的选择视为不同子序列。','一行仅含小写英文字母的 word；本站补充 1≤|word|≤200000，以适配原题未给出的长度上界。','输出符合条件的非空子序列数量模 1,000,000,007。',['abca','abcd','aaa'],lambda s:s+'\n',good_subseq_oracle,word_random,
'''def solve(raw):
    MOD=1000000007; s=raw.strip(); n=len(s); cnt=[0]*26
    for c in s: cnt[ord(c)-97]+=1
    fact=[1]*(n+1)
    for i in range(1,n+1): fact[i]=fact[i-1]*i%MOD
    inv=[1]*(n+1); inv[n]=pow(fact[n],MOD-2,MOD)
    for i in range(n-1,-1,-1): inv[i]=inv[i+1]*(i+1)%MOD
    ans=0
    for k in range(1,max(cnt)+1):
        prod=1
        for c in cnt:
            if c>=k: prod=prod*(fact[c]*inv[k]%MOD*inv[c-k]+1)%MOD
        ans=(ans+prod-1)%MOD
    return str(ans)
''', [('漏掉空集合校正','ans=(ans+prod-1)%MOD','ans=(ans+prod)%MOD'),('组合数使用频次而非选取数','fact[c]*inv[k]%MOD*inv[c-k]','fact[c]*inv[c]%MOD*inv[k-c]')], '枚举统一频次 k。对于至少出现 k 次的每个字符，选择 C(count,k) 个下标，或不选择该字符；全不选的方案需去掉。','任一非空好子序列都有唯一的正频次 k。固定 k 时，不同字符的下标选择彼此独立，乘积枚举所有频次恰为 k 的子序列；减去空选择后非空。对所有 k 求和不会重复。','时间 O(n+26·maxCount)，空间 O(n)。'),
spec('nutanix',3,'Min Cost to Connect All Points','点间连边代价为曼哈顿距离。求连接所有点且任意两点间有唯一简单路径的最小总边权。','n（1≤n≤1000），之后 n 行为整数坐标 x y（−10^6≤x,y≤10^6），坐标互不相同。','输出最小生成树总权值。',[[[0,0],[2,2],[3,10],[5,2],[7,0]],[ [3,12],[-2,5],[-4,1] ],[[4,-2]]],points_encode,mst_oracle,points_random,
'''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; p=[tuple(v[1+2*i:3+2*i]) for i in range(n)]
    best=[10**30]*n; best[0]=0; used=[False]*n; total=0
    for _ in range(n):
        u=min((i for i in range(n) if not used[i]),key=lambda i:best[i]); used[u]=True; total+=best[u]
        for j in range(n):
            if not used[j]: best[j]=min(best[j],abs(p[u][0]-p[j][0])+abs(p[u][1]-p[j][1]))
    return str(total)
''', [('漏掉横坐标差','abs(p[u][0]-p[j][0])+abs(p[u][1]-p[j][1])','abs(p[u][0]-p[j][0])'),('最大生成树式更新','best[j]=min(best[j],abs(p[u][0]-p[j][0])+abs(p[u][1]-p[j][1]))','best[j]=max(best[j],abs(p[u][0]-p[j][0])+abs(p[u][1]-p[j][1]))')], '在完全图上运行稠密 Prim；每次加入离当前树最近的未访问点，并更新其他点的最小曼哈顿距离。','Prim 每轮选择跨越当前生成树与未访问点集合的最小边。加入该边不会形成环；更新后保持每个未访问点到树的最小边权。n 轮后得到最小生成树。','时间 O(n²)，空间 O(n)。'),
spec('nutanix',6,'Number of Players','按竞赛排名统计可升级玩家数：分数相同者同名次，下一个不同分数的名次等于其排序位置；分数为 0 的玩家永不升级。','第一行 n k（1≤n≤100000，1≤k≤n），下一行 n 个分数（0≤score≤100）。','输出名次不超过 k 且分数大于 0 的玩家数。',[(3,[100,50,50,25]),(4,[20,40,60,80,100]),(4,[2,2,3,4,5])],players_encode,players_oracle,players_random,
'''def solve(raw):
    v=list(map(int,raw.split())); n,k=v[:2]; scores=sorted(v[2:2+n],reverse=True); ans=0; rank=1
    for i,s in enumerate(scores):
        if i and s!=scores[i-1]: rank=i+1
        if rank<=k and s>0: ans+=1
    return str(ans)
''', [('将并列分数拆成不同名次','if i and s!=scores[i-1]: rank=i+1','rank=i+1'),('把 0 分玩家计入','if rank<=k and s>0: ans+=1','if rank<=k: ans+=1')], '按分数降序排序；相同分数保持前一名次，不同分数的名次为下标加一。','降序位置即竞技排名定义。仅累加名次不超过 k 且得分非零的玩家，逐个对应题目资格条件。','时间 O(n log n)，空间 O(n)。'),
spec('deloitte',1,'Make Grid Symmetric','每次可翻转一个格子的颜色。求最少翻转次数，使每一行和每一列都分别关于中心对称。','第一行 n m（1≤n,m≤200），之后 n 行长度 m 的字符串，仅含 B/W。n、m 上限是本站补充，原题未给。','输出最少翻转格数。',[['BBWWB','WWWBW','BWWWB'],['BWB','WBB','WBW'],['W']],grid_encode,grid_oracle,grid_random,
'''def solve(raw):
    v=raw.split(); n=int(v[0]); m=int(v[1]); g=v[2:2+n]; seen=set(); ans=0
    for i in range(n):
        for j in range(m):
            if (i,j) in seen: continue
            cells={(i,j),(i,m-1-j),(n-1-i,j),(n-1-i,m-1-j)}; seen |= cells
            blacks=sum(g[r][c]=='B' for r,c in cells); ans+=min(blacks,len(cells)-blacks)
    return str(ans)
''', [('只约束行镜像','cells={(i,j),(i,m-1-j),(n-1-i,j),(n-1-i,m-1-j)}','cells={(i,j),(i,m-1-j)}'),('总是翻转到白色','ans+=min(blacks,len(cells)-blacks)','ans+=blacks')], '按上下、左右镜像将相互约束的格子分组成至多四格的轨道；每组统一成多数颜色。','行与列对称要求同一轨道内所有格子相等，且不同轨道互不约束。每个轨道选择多数颜色所需翻转最少，逐轨道最优解相加即全局最优。','时间 O(nm)，额外空间 O(nm)。'),
spec('deloitte',3,'Maximum Strings Buildable from at Most K Letters','从 a–j 中选至多 K 种字母（选中的字母可重复使用），最多能完整拼出多少个给定字符串。','第一行 n K（1≤n≤100000，0≤K≤10）；之后 n 行为非空小写字符串，仅含 a–j。长度总和≤200000（本站补充）。','输出可拼出的最大字符串数。',[(3,['adf','jjbh','jcg','eijj','adf']),(3,['abcd','efgh']),(4,['bc','edf','fde','dge','abcd'])],strings_encode,buildable_oracle,strings_random,
'''def solve(raw):
    v=raw.split(); n=int(v[0]); k=int(v[1]); ss=v[2:2+n]; masks=[]
    for s in ss:
        m=0
        for c in s: m|=1<<(ord(c)-97)
        masks.append(m)
    return str(max(sum((m & ~mask)==0 for m in masks) for mask in range(1<<10) if mask.bit_count()<=k))
''', [('把至多 K 错写成至少 K','mask.bit_count()<=k','mask.bit_count()>=k'),('只计算字符串与选择集合交集为空','(m & ~mask)==0','(m & mask)==0')], '将每个字符串压缩为字母集合位掩码，枚举不超过 K 个字母的集合并计数。','字符串可拼出当且仅当它使用的每种字母都在选择集合内。枚举所有合法集合覆盖了任意选择方案，取最大计数即最优值。选择更多字母不会降低可拼数量，因此恰选 K 在 K≤10 时也可，但实现直接按“至多”枚举。','时间 O(2^10·n+总字符数)，空间 O(n)。'),
spec('deloitte',6,'Longest Substring with Even Occurrences','求最长连续子串，使其中每个英文字母都出现偶数次；若不存在非空子串则输出 0。','一行仅含小写英文字母的字符串，1≤|S|≤100000。','输出最长长度。',['bdaaadadb','abacb','zthtzh'],lambda s:s+'\n',even_substring_oracle,even_random,
'''def solve(raw):
    s=raw.strip(); first={0:-1}; mask=0; best=0
    for i,c in enumerate(s):
        mask ^= 1 << (ord(c)-97)
        if mask in first: best=max(best,i-first[mask])
        else: first[mask]=i
    return str(best)
''', [('重复掩码只保留最新位置','else: first[mask]=i','first[mask]=i'),('把奇偶翻转错写成置位','mask ^= 1 << (ord(c)-97)','mask |= 1 << (ord(c)-97)')], '将 26 个字母的出现奇偶状态编码成位掩码，记录每种状态最早出现位置。','两个前缀奇偶掩码相同，其间每个字母出现偶数次；固定右端点时选择最早位置能得到最长子串。遍历所有前缀取最大长度即全局最优。','时间 O(n)，空间 O(min(n,2^26))。'),
spec('upstart',1,'Bounding Box from Coordinates','求覆盖所有二维点的最小轴对齐矩形，输出左下角坐标和宽高。','n（1≤n≤200000），之后 n 行为整数 x y（−10^9≤x,y≤10^9）。','输出 minX minY width height，空格分隔。',[[ (2,3),(5,7),(1,4) ],[(0,0)]],points_encode,points_box_oracle,points_box_random,
'''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; xs=v[1::2][:n]; ys=v[2::2][:n]
    return f"{min(xs)} {min(ys)} {max(xs)-min(xs)} {max(ys)-min(ys)}"
''', [('交换宽高来源','max(xs)-min(xs)} {max(ys)-min(ys)','max(ys)-min(ys)} {max(xs)-min(xs)'),('遗漏单点跨度','max(xs)-min(xs)','max(xs)-min(xs)+1')], '一次遍历维护 x、y 的最小值与最大值。','轴对齐包围盒的左右边界分别是所有 x 的极值，上下边界是所有 y 的极值；跨度之差即宽和高。','时间 O(n)，额外空间 O(n)（读取输入）。',bound=5000000),
spec('upstart',4,'Find the Wrong Digit Index in a Sum','比较 num1+num2 与 givenSum 的十进制位，从个位开始编号为 0；缺失高位视为 0。返回第一个不同位索引，完全相同返回 −1。','一行三个非负整数 num1 num2 givenSum，均≤10^18。','输出第一个不匹配位的索引，或 -1。',[(13,7,19),(95,5,100),(0,0,0),(12,3,25)],wrong_digit_encode,wrong_digit_oracle,wrong_digit_random,
'''def solve(raw):
    a,b,g=map(int,raw.split()); c=a+b; i=0
    while c or g:
        if c%10!=g%10: return str(i)
        c//=10; g//=10; i+=1
    return '-1'
''', [('从最高位开始比较','if c%10!=g%10: return str(i)','if c//10!=g//10: return str(i)'),('丢弃进位后高位','c//=10; g//=10; i+=1','c//=10; g//=10; i+=2')], '直接逐位取两个数的个位数字比较，之后各自整除 10；首次不同即返回当前下标。','每轮处理的正是当前最低位，比较顺序严格从个位向高位推进。若循环结束则两数均无剩余位，缺失位按 0 补齐后仍完全相同。','时间 O(log(max(num1+num2,givenSum)))，空间 O(1)。'),
spec('wayfair',4,'Validating Magical Binary Strings with RegEx','判断二进制字符串是否以 1 开头，且包含至少两个 0、总 0 数为偶数。','第一行 q（1≤q≤1000），之后 q 行各为长度 1..1000 的二进制字符串。','每个字符串输出 True 或 False，各占一行。',[['1001'],['11000'],['0101'],['1010'],['1111']],wayfair_encode,lambda q: bool(re.fullmatch(r'1(1*01*0)+1*',q[0])),lambda r: [''.join(r.choice('01') for _ in range(r.randint(1,30)))],
'''def solve(raw):
    v=raw.split(); q=int(v[0]); return "\\n".join("True" if s[0]=='1' and s.count('0')>=2 and s.count('0')%2==0 else "False" for s in v[1:1+q])
''', [('未要求偶数个零','s.count(\'0\')%2==0','True'),('允许以零开头','s[0]==\'1\' and s.count','s.count')], '检查首字符和 0 的数量；至少两个且为偶数时符合条件。','题目定义恰为三个条件的合取。由于输入字符限定为二进制，首字符校验与 0 数量校验足以覆盖所有条件。','时间 O(total length)，额外空间 O(1)。',bound=1100000),
]


BLOCKED_REASONS = {
    'canva-1':'原始页面示例只有“RRR→0”，没有明示目标坐标/起点与允许指令字母以外字符的处理；本批不额外补输入契约。',
    'canva-4':'“删除最轻罐头及其相邻罐头”未说明删除后剩余原位置邻居还是当前剩余序列邻居，规则可能影响后续选择。',
    'canva-5':'原始完整 MDX 在 arr[i] 约束处截断为 `arr[i]</cod`，缺少数值范围；“每个元素最多交换一次”还需明确元素身份和相邻交换组合规则。',
    'walmart-1':'题面只有占位描述与 humorous 输出，无法定义计算规则。',
    'walmart-2':'定义要求前半字符全相等、后半字符全相等，但示例解释把“3443”判为 good，与定义直接矛盾；约束也为未知占位符。',
    'walmart-3':'操作文字可读，但没有说明最小步数的输出类型/完整示例；本批优先选有完整约束和例子的题。',
    'nutanix-2':'示例三参数写 day_hours=8，解释却改写为 2；虽该样例输出碰巧相同，未确认源题正确参数含义前暂缓。',
    'nutanix-4':'算法规则可解释，但 N/数值约束均为 N/A；穷举旋转后最少交换为 O(n²)，本批不猜测安全输入上限。',
    'nutanix-5':'“only one repetitive alphabet”与重排/插入的措辞及唯一示例含义不清，无法确定是只能重排现有字符还是可添加字符。',
    'deloitte-2':'没有输入格式和节点编号/根节点约定；本批不猜树的序列化协议。',
    'deloitte-4':'“permutation[i] divisible by i”与第二例对 i=2 写的“i divisible by permutation[i]”方向不一致，缺少可消歧样例。',
    'deloitte-5':"说明输入用 '?' 表示未安装房屋，但假设又写字符仅有 a、b、'-'；允许字符冲突且无样例。",
    'upstart-2':'固定源页面保留为 HTML 转义片段 `&lt;p cl`，核心操作与完整题意未能恢复。',
    'upstart-3':'没有给同分最高记录的选择规则，返回姓名在多个答案间不唯一。',
    'confluent-1':'菜单套餐的覆盖/多份购买规则不完整，来源还注明题目可能不完全正确；最低价无法唯一确定。',
    'confluent-2':'字符串换行与末尾换行如何映射为返回行未定义；原题示例把末尾空行忽略，但未覆盖空行。',
    'confluent-3':'缺少 n 和交易额范围，题面将指数枚举与 DP 作为讨论题；无法设定可信的在线评测界限。',
    'confluent-4':'输入是任意字符串行，标准 token 判题会丢失空行与行内空格；本批未定义可保真序列化协议。',
    'rippling-1':'四道选择题中第一题“max-heapify刚完成”未指出堆的起始状态或当前被替换节点，选项可能依赖实现。',
    'rippling-2':'题面示例 IP 含 420、312 等非法八位段，解释中又换成另一 IP；对具体样例结果存在源数据冲突。',
    'rippling-3':'依赖外部 REST API 返回数据集且未固定快照、字段模式与错误处理，结果不能确定性复现。',
    'rippling-4':'矩形网格节点是整数格点还是连续坐标未明示，且缺少全部坐标范围。',
    'rippling-5':'processor 在暂停 1 秒后可否立即继续、总时间是否包含最后暂停没有被样例覆盖，至少会影响单处理器多任务答案。',
    'rippling-6':'原始页面后续示例/约束未完全审计；“transfer time between connected servers”与最大任意点对距离可算树直径，但需先确认完整题面输入范围。',
    'wayfair-1':'输出所有子序列，原始题称 MLE 且没有输入长度界；输出规模呈指数增长，不适合作为当前在线判题题包。',
    'wayfair-2':'依赖一张字符映射表；完整表在原页面未被可靠恢复，本批不推测映射。',
    'wayfair-3':'大锤/小锤操作的顺序、每次挥击与锤子耐久更新在题面快照中不足以唯一确定。',
    'plaid-1':'原题只称 integer n，没有明确是否允许负数；负号计不计入“第一位/交替符号”会影响结果。',
    'plaid-2':'移动 k 张牌后 deck 的方向/剩余牌是否保持原顺序可推断，但题面未说明 n=0 操作是否计为一步；已在现批排除。',
    'plaid-3':'传送落点能否重复访问、起终点为障碍时的处理、是否允许经过已访问格缺少规则；“最多访问格子”无法唯一判定。',
    'plaid-4':'原始长度上界 10^8 超出本地评测输入可承载范围；本批不擅自缩小来源约束并发布。',
    'ramp-1':'多阶段 banking system 涉及 scheduled payment、退款、合并及 timestamp 顺序；超出本批能够逐条重建状态机并证明的范围。',
    'ramp-2':'cashback 到期时余额不足、同一时刻事件排序及非法请求状态变更规则需对照完整阶段题面；本批暂缓。',
    'ramp-3':'与 Banking System I 为同一多阶段状态题但 API 返回语义不同，合并账户后的 scheduled payment 所属关系需严格核对全部阶段。',
    'ramp-4':'文字明确 inclusive window，但例一在时间差恰为 timeWindow 时又接受请求；窗口边界相矛盾，且示例 IP 非法。',
}


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','candidate-batches','validation','reviews','source-evidence'):
        (OUT/folder).mkdir(parents=True, exist_ok=True)
    catalog=json.loads((ROOT/'content/oa-master/catalog.json').read_text())
    selected={(s['company'],s['number']) for s in SPECS}
    batch=[]; validation=[]; review_items=[]; evidence_items=[]; blocked={}
    for s in SPECS:
        source_id=f"oa-{s['company']}-{s['number']}"
        source=next(x for x in catalog['items'] if x['id']==source_id)
        code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
        rng=random.Random(SEED+s['number']+sum(map(ord,s['company'])))
        random_cases=[s['random'](rng) for _ in range(163-len(s['samples']))]
        oracle_cases=s['samples']+random_cases
        formal_cases=s['samples']+random_cases[:31-len(s['samples'])]
        encoded=[s['encode'](case) for case in oracle_cases]
        expected=[str(s['oracle'](case))+'\n' for case in oracle_cases]
        formal=[dict(name=f'样例 {i+1}' if i<3 else f'组合 {i-2}',input=s['encode'](case),expectedOutput=str(s['oracle'](case))+'\n',hidden=i>=3,weight=1)
                for i,case in enumerate(formal_cases)]
        # Run the authored reference in an isolated Python process, never the upstream code.
        ref_path=OUT/'references'/f'{source_id}.py'; ref_path.write_text(code)
        outputs=helper.execute(ref_path,encoded)
        for i,(got,want) in enumerate(zip(outputs,expected)):
            if got.split()!=want.split(): raise AssertionError((source_id,i,got,want))
        mutant_data=[]; rejected=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            if old not in code: raise AssertionError((source_id,'mutation pattern missing',old))
            mutant=code.replace(old,new,1)
            path=OUT/'negative-controls'/f'{source_id}-{j}.py'; path.write_text(mutant)
            bad=helper.execute(path,[case['input'] for case in formal])
            killed=[i for i,(got,case) in enumerate(zip(bad,formal)) if got.split()!=case['expectedOutput'].split()]
            if not killed: raise AssertionError((source_id,'mutant survived',name))
            mutant_data.append(dict(name=name,code=mutant)); rejected.append(dict(name=name,rejectedByCases=killed))
        package=dict(schemaVersion=1,problem=dict(id=source_id,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA',source['companyName']],description=s['desc']+'\n\n本站标准输入输出格式及任何补充范围以本题说明为准。',input=s['limits'],output=s['output'],explanation=s['idea'],hints=[s['idea']],timeLimit=6,memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp']),cases=formal)
        payload=json.dumps(package,ensure_ascii=False,separators=(',',':'))
        parsed=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=payload,text=True,capture_output=True)
        if parsed.returncode: raise RuntimeError(parsed.stderr[:2000])
        normalized=parsed.stdout
        (OUT/'packages'/f'{source_id}.json').write_text(json.dumps(json.loads(normalized),ensure_ascii=False,indent=2)+'\n')
        (OUT/'oracles'/f'{source_id}.json').write_text(json.dumps([dict(input=a,expectedOutput=e) for a,e in zip(encoded,expected)],ensure_ascii=False,indent=2)+'\n')
        (OUT/'mutants'/f'{source_id}.json').write_text(json.dumps(mutant_data,ensure_ascii=False,indent=2)+'\n')
        proof=s['proof']; editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{s['complexity']}"
        (OUT/'editorials'/f'{source_id}.json').write_text(json.dumps(dict(schemaVersion=1,id=source_id,title=s['title'],explanation=editorial,solutions=[dict(language='python',code=code)],sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork'),ensure_ascii=False,indent=2)+'\n')
        batch.append(dict(id=source_id,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=[dict(language='python',code=code)]))
        validation.append(dict(id=source_id,oracleCases=len(oracle_cases),publicCases=3,hiddenCases=len(formal)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=rejected,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        path,blob=RAW[s['company']]
        reason='核验固定源提交中的完整公司 MDX 页面、此题前后标题及题面/约束/例子；离线参考解与独立 oracle 对照 163 组，并由两个正常退出错误程序验证反例；未运行 GoJudge。'
        review_items.append(dict(id=source_id,status='authored',reason=reason))
        evidence_items.append(dict(id=source_id,catalogContentHash=source['contentHash'],sourceUrl=source['sourceUrl'],status='authored',reason=reason,path=path,gitBlobSha=blob))
        print(source_id, '163 independent oracle cases; 2 mutants killed', flush=True)
    for item in catalog['items']:
        if item['companySlug'] not in RAW or (item['companySlug'],item['number']) in selected: continue
        key=f"{item['companySlug']}-{item['number']}"
        reason=BLOCKED_REASONS.get(key,'该题原始完整页面已审阅，但未进入本批：当前快照缺少足够明确的输入/输出、约束，或题量/状态语义需要额外裁定；避免自行补造判题规则。')
        blocked[item['id']]=reason
        review_items.append(dict(id=item['id'],status='blocked',reason=reason))
        path,blob=RAW[item['companySlug']]
        evidence_items.append(dict(id=item['id'],catalogContentHash=item['contentHash'],sourceUrl=item['sourceUrl'],status='blocked',reason=reason,path=path,gitBlobSha=blob))
    sort_key=lambda x:(x.get('id',''),)
    batch.sort(key=lambda x:x['id']); validation.sort(key=sort_key); review_items.sort(key=sort_key); evidence_items.sort(key=sort_key)
    (OUT/'candidate-batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=batch),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=validation,skipped=blocked,note='仅本地独立 oracle 与正常退出 mutant 验证；没有 GoJudge 报告，不代表线上可提交。'),ensure_ascii=False,indent=2)+'\n')
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=review_items),ensure_ascii=False,indent=2)+'\n')
    pages=[dict(company=slug,path=path,gitBlobSha=blob,sha256=RAW_SHA256[slug]) for slug,(path,blob) in sorted(RAW.items())]
    (OUT/'source-evidence'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,repository='https://github.com/RedInn7/OA-Master',commit=SOURCE_COMMIT,reason='从不可变上游 MDX 快照逐题审阅；不执行源仓库代码。',pages=pages,items=evidence_items),ensure_ascii=False,indent=2)+'\n')
    print(f"candidate={len(batch)} blocked={len(blocked)}")


if __name__ == '__main__': main()
