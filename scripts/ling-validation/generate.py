#!/usr/bin/env python3
"""Generate deterministic ORIGINAL fixtures. Never imports or executes reference sources."""
import argparse, hashlib, json, random
from pathlib import Path
from collections import deque
from mutants import for_problem

IDS = [3, 11, 35, 53, 121, 198, 209, 322, 69, 1456]
METHODS = ['lengthOfLongestSubstring','maxArea','searchInsert','maxSubArray','maxProfit','rob','minSubArrayLen','coinChange','mySqrt','maxVowels']
META = {
3: ('无重复字符的最长子串','Longest Substring Without Repeating Characters','求字符串中不含重复字符的最长连续子串长度。空串答案为 0。','Find the maximum length of a contiguous substring containing no repeated character. An empty string has answer 0.','一行字符串 s，允许为空，保留空格；0 ≤ 长度 ≤ 50000，字符为可打印 ASCII。','One line containing s, possibly empty; spaces are significant. Length 0–50000; printable ASCII characters.'),
11: ('盛最多水的容器','Container With Most Water','从数组选择两个不同下标 i < j，最大化 (j-i) × min(height[i], height[j])。','Choose two indices i < j maximizing (j-i) × min(height[i], height[j]).','第一行 n；第二行 n 个高度。2 ≤ n ≤ 100000，0 ≤ 高度 ≤ 10000。','First line: n. Second line: n heights. 2 ≤ n ≤ 100000; heights 0–10000.'),
35: ('搜索插入位置','Search Insert Position','给定严格递增整数数组和 target，返回 target 的下标；不存在则返回保持升序时的插入下标。下标从 0 开始。','In a strictly increasing integer array, return the index of target, or its insertion index preserving order. Indices are zero-based.','第一行 n target；第二行 n 个整数。1 ≤ n ≤ 10000，元素与 target 在 [-10000,10000]。','First line: n target. Second line: n integers. 1 ≤ n ≤ 10000; values and target in [-10000,10000].'),
53: ('最大子数组和','Maximum Subarray','求非空连续子数组的最大元素和。','Return the largest sum of a nonempty contiguous subarray.','第一行 n；第二行 n 个整数。1 ≤ n ≤ 100000，元素在 [-10000,10000]。','First line: n. Second line: n integers. 1 ≤ n ≤ 100000; values in [-10000,10000].'),
121: ('买卖股票的最佳时机','Best Time to Buy and Sell Stock','最多买入一次并在之后某天卖出，求最大利润。允许不交易，利润为 0。','Buy at most once and sell on a later day. Return the maximum profit, or 0 when making no transaction is best.','第一行 n；第二行 n 个价格。1 ≤ n ≤ 100000，价格在 [0,10000]。','First line: n. Second line: n prices. 1 ≤ n ≤ 100000; prices in [0,10000].'),
198: ('打家劫舍','House Robber','选择若干互不相邻的数组元素，求最大总和，可以不选。','Choose nonadjacent array elements to maximize their sum. Choosing none is allowed.','第一行 n；第二行 n 个金额。1 ≤ n ≤ 100，金额在 [0,400]。','First line: n. Second line: n amounts. 1 ≤ n ≤ 100; amounts in [0,400].'),
209: ('长度最小的子数组','Minimum Size Subarray Sum','给定正整数数组，求元素和至少为 target 的最短连续子数组长度；不存在返回 0。','Given a positive integer array, find the shortest contiguous subarray with sum at least target. Return 0 if none exists.','第一行 n target；第二行 n 个正整数。1 ≤ n ≤ 100000，元素在 [1,10000]，1 ≤ target ≤ 1000000000。','First line: n target. Second line: n positive integers. 1 ≤ n ≤ 100000; values 1–10000; target 1–1000000000.'),
322: ('零钱兑换','Coin Change','每种硬币可以无限使用，求凑出 amount 的最少硬币数；无法凑出返回 -1，amount 为 0 返回 0。','Each denomination is available without limit. Return the fewest coins totaling amount, -1 if impossible, or 0 when amount is zero.','第一行 n amount；第二行 n 个不同面值。1 ≤ n ≤ 12，1 ≤ 面值 ≤ 2147483647，0 ≤ amount ≤ 10000。','First line: n amount. Second line: n distinct denominations. 1 ≤ n ≤ 12; denominations 1–2147483647; amount 0–10000.'),
69: ('整数平方根','Integer Square Root','给定非负整数 x，返回不超过其平方根的最大整数。','Given a nonnegative integer x, return the greatest integer whose square is at most x.','一行整数 x，0 ≤ x ≤ 2147483647。','One integer x, with 0 ≤ x ≤ 2147483647.'),
1456: ('定长子串中元音的最大数目','Maximum Number of Vowels in a Substring of Given Length','求长度恰为 k 的连续子串中元音字符的最大数量。元音为 a、e、i、o、u。','Find the maximum number of vowels in a contiguous substring of exactly length k. Vowels are a, e, i, o, u.','第一行小写英文字母字符串 s；第二行 k。1 ≤ 长度 ≤ 100000，1 ≤ k ≤ 长度。','First line: lowercase English string s. Second line: k. Length 1–100000; 1 ≤ k ≤ length.'),
}

def brute(pid, a):
    """Small-instance independent exhaustive or graph-search oracle."""
    x=a[0]
    if pid==3: return max([0]+[j-i for i in range(len(x)) for j in range(i+1,len(x)+1) if len(set(x[i:j]))==j-i])
    if pid==11: return max(min(x[i],x[j])*(j-i) for i in range(len(x)) for j in range(i+1,len(x)))
    if pid==35: return sum(v<a[1] for v in x)
    if pid==69: return sum(i*i<=x for i in range(1,x+1))
    if pid==53: return max(sum(x[i:j]) for i in range(len(x)) for j in range(i+1,len(x)+1))
    if pid==121: return max([0]+[x[j]-x[i] for i in range(len(x)) for j in range(i+1,len(x))])
    if pid==198: return max(sum(x[i] for i in range(len(x)) if m>>i&1) for m in range(1<<len(x)) if not(m & (m<<1)))
    if pid==209:
        target,nums=a
        return min([len(nums)+1]+[j-i for i in range(len(nums)) for j in range(i+1,len(nums)+1) if sum(nums[i:j])>=target])%(len(nums)+1)
    if pid==322:
        coins,amount=a;q=deque([(0,0)]);seen={0}
        while q:
            v,d=q.popleft()
            if v==amount:return d
            for c in coins:
                if v+c<=amount and v+c not in seen:seen.add(v+c);q.append((v+c,d+1))
        return -1
    if pid==1456:return max(sum(c in 'aeiou' for c in x[i:i+a[1]]) for i in range(len(x)-a[1]+1))
    raise ValueError(pid)

def encode(pid,a):
    if pid==69:return str(a[0])+'\n'
    if pid==3:return a[0]+'\n'
    if pid==1456:return a[0]+'\n'+str(a[1])+'\n'
    nums=a[1] if pid==209 else a[0]
    extra=(' '+str(a[0] if pid==209 else a[1])) if len(a)==2 else ''
    return str(len(nums))+extra+'\n'+' '.join(map(str,nums))+'\n'

def random_args(pid,r):
    n=r.randint(2 if pid==11 else 1,12)
    if pid==3:return [''.join(r.choices('abCD01 !?',k=r.randint(0,14)))]
    if pid==1456:return [''.join(r.choices('aeioubcdfg',k=n)),r.randint(1,n)]
    if pid==69:return [r.randint(0,2000)]
    if pid==35:return [sorted(r.sample(range(-25,26),n)),r.randint(-27,27)]
    if pid==209:return [r.randint(1,130),[r.randint(1,12) for _ in range(n)]]
    if pid==322:return [r.sample(range(1,20),r.randint(1,6)),r.randint(0,70)]
    return [[r.randint(-15 if pid==53 else 0,20) for _ in range(n)]]

EDGE={3:[['abcabcbb'],[''],[' '],['bbbbb'],['pwwkew'],['abba'],['dvdf'],['a a!']],11:[[[1,8,6,2,5,4,8,3,7]],[[0,0]],[[1,1]],[[1,2,4,3]],[[9,0,0,9]]],35:[[[1,3,5,6],5],[[1],0],[[1],2],[[1,3],2],[[1,3],3]],53:[[[-2,1,-3,4,-1,2,1,-5,4]],[[-1]],[[-8,-3,-9]],[[0,0]],[[5,-2,5]]],121:[[[7,1,5,3,6,4]],[[7,6,4,3,1]],[[0]],[[2,2,2]],[[4,1,2]]],198:[[[1,2,3,1]],[[0]],[[400]],[[2,1,1,2]],[[2,7,9,3,1]]],209:[[7,[2,3,1,2,4,3]],[1,[1]],[2,[1]],[6,[1,2,3]],[5,[1,1,8,1]]],322:[[[1,2,5],11],[[2],3],[[1],0],[[2147483647],1],[[2,3,7],13]],69:[[8],[0],[1],[2],[4],[15],[16],[17]],1456:[['abciiidef',3],['a',1],['z',1],['aeiou',5],['bcdfg',3],['zaaaa',4]]}
PRESSURE={3:[(['a'*50000],1),([''.join(chr(32+i%95) for i in range(50000))],95)],11:[([[10000]*100000],999990000),([[10000]+[0]*99998+[10000]],999990000)],35:[([list(range(-10000,10000,2)),9999],10000),([list(range(-10000,10000,2)),-10000],0)],53:[([[10000]*100000],1000000000),([[-10000]*100000],-10000)],121:[([[10000]*99999+[0]],0),([[0]+[10000]*99999],10000)],198:[([[400]*100],20000),([[0,400]*50],20000)],209:[([1000000000,[10000]*100000],100000),([1000000000,[1]*100000],0)],322:[([[1],10000],10000),([[2],9999],-1),([[1,2,5,10,20,25,50,100,200,500,1000,2000],10000],5)],69:[([2147483647],46340),([2147395600],46340),([2147395599],46339)],1456:[(['a'*100000,50000],50000),(['z'*100000,100000],0)]}

def wrapper(pid,source):
    prefix='from typing import *\nfrom collections import *\nfrom functools import *\nfrom itertools import *\nfrom bisect import *\nfrom math import *\nimport sys, json\n'
    # Signature is explicit per problem. No inferred types or permissive argument trimming.
    method=METHODS[IDS.index(pid)]
    parse="args=[int(sys.stdin.read())]" if pid==69 else "args=[sys.stdin.readline().rstrip('\\n').rstrip('\\r')]" if pid==3 else "args=[sys.stdin.readline().strip(),int(sys.stdin.readline())]" if pid==1456 else "v=list(map(int,sys.stdin.read().split()));n=v[0];assert len(v)==n+"+('2' if pid in (35,209,322) else '1')+";args="+('[v[1],v[2:]]' if pid==209 else '[v[2:],v[1]]' if pid in (35,322) else '[v[1:]]')
    return prefix+source+'\nif __name__=="__main__":\n    if "--batch" in sys.argv:\n        for args in json.load(sys.stdin):\n            print(Solution().'+method+'(*args))\n    else:\n        '+parse+'\n        print(Solution().'+method+'(*args))\n'

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--references',type=Path,required=True);ap.add_argument('--list',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    listing=json.loads(a.list.read_text());listed={n for t in listing['topics'].values() for n in t['problems']};assert set(IDS)<=listed
    records=[]
    for pid in IDS:
        r=random.Random(20260905+pid);sourcepath=next(a.references.glob(f'*/*{pid:04d}.*'+'/Solution.py'));source=sourcepath.read_text();slug=sourcepath.parent.name.split('.',1)[1];slug='-'.join(slug.lower().split()).replace('(', '').replace(')', '')
        z,e,zd,ed,zi,ei=META[pid];base=dict(title=z,description=zd,input=zi,output='输出一个整数和换行。',explanation='样例遵循上述定义；下标均从 0 开始。',hints=[])
        edges = EDGE[pid] + ([[[1,3,4],6]] if pid == 322 else [])
        formal=[(x,brute(pid,x),'边界 '+str(i)) for i,x in enumerate(edges)]+[(x,brute(pid,x),'固定种子随机 '+str(i)) for i in range(24) for x in [random_args(pid,r)]]+[(x,y,'规模上限 '+str(i)) for i,(x,y) in enumerate(PRESSURE[pid])]
        cases=[dict(name='样例 1' if i==0 else n,input=encode(pid,x),expectedOutput=str(y)+'\n',hidden=i!=0,weight=1) for i,(x,y,n) in enumerate(formal)]
        pkg=dict(schemaVersion=1,problem=dict(id=f'lc-{pid}',courseId='gomall',lessonId='00-overview',difficulty='简单' if pid in (35,121,69) else '中等',tags=['灵神题单'],**base,translations={'en':dict(title=e,description=ed,input=ei,output='Print one integer followed by a newline.',explanation='The sample follows the definition above. All indices are zero-based.',hints=[])},timeLimit=2,memoryLimit=262144,outputLimit=64,checker='tokens',languages=['python','go','java','cpp']),cases=cases)
        # Packages are candidates until sandbox validation has passed.
        raw=json.dumps(pkg,ensure_ascii=False,indent=2)+'\n';(a.out/f'lc-{pid}.candidate.json').write_text(raw);wrapped=wrapper(pid,source);(a.out/f'lc-{pid}.reference.py').write_text(wrapped)
        small=[random_args(pid,r) for _ in range(120)];(a.out/f'lc-{pid}.oracle.json').write_text(json.dumps({'args':small,'expected':[brute(pid,x) for x in small]}))
        mutant_raw = json.dumps(for_problem(pid), ensure_ascii=False, indent=2) + '\n'
        (a.out/f'lc-{pid}.mutants.json').write_text(mutant_raw)
        records.append(dict(id=f'lc-{pid}',sourceUrl=f'https://leetcode.com/problems/{slug}/',sourceUrlZh=f'https://leetcode.cn/problems/{slug}/',reference=str(sourcepath),referenceSha256=hashlib.sha256(source.encode()).hexdigest(),wrapperSha256=hashlib.sha256(wrapped.encode()).hexdigest(),packageSha256=hashlib.sha256(raw.encode()).hexdigest(),formalCases=len(cases),oracleCases=len(small),status='candidate'))
        records[-1]['mutantsSha256'] = hashlib.sha256(mutant_raw.encode()).hexdigest()
    (a.out/'manifest.json').write_text(json.dumps(dict(seed=20260905,attribution='Problem identities: LeetCode; study list: endlesscheng; private reference solutions: local doocs/leetcode; statements and test fixtures authored for cswork.',problems=records),ensure_ascii=False,indent=2)+'\n');print('Generated',len(records),'candidate packages; no reference code executed.')
if __name__=='__main__':main()
