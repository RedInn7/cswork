#!/usr/bin/env python3
"""Original streaming fence DP; independent painting-state BFS and interval oracle."""
from pathlib import Path
from itertools import product
from collections import deque
import hashlib,json,random,subprocess,tempfile,time,re,io
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-gemini-1';BATCH='gemini-1-recovered';SEED=20261116
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='fastprep/Gemini/gemini-minimum-fence-painting-operations.md'
RAW_SHA='092dff9e2704cea781b84ecf07d319703a4b5534eea1b6d651a82493e16e065e'
HASH='010eda54532f975700491b0f33cd778f64c03d725a81bbc7392dac2ba8d2e7b4'
BUDGET=32*1024*1024
REFERENCE=r'''#include <cstdio>
#include <cstdint>
#include <vector>
#include <algorithm>
using namespace std;
uint32_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint32_t x=0;while(c>32&&c!=EOF){x=x*10+uint32_t(c-'0');c=getchar_unlocked();}return x;}
struct Node{uint32_t height,width,cost;};
static_assert(sizeof(Node)==12);
int main(){uint32_t n=readNumber();vector<Node> st;st.reserve(size_t(n)+1);st.push_back({0,0,0});
auto append=[&](uint32_t h,uint32_t width){uint32_t cost=0;
while(st.back().height>h){Node node=st.back();st.pop_back();uint32_t base=max(h,st.back().height);
uint32_t value=uint32_t(min<uint64_t>(node.width,uint64_t(node.cost)+node.height-base));
if(st.back().height>=h){st.back().width+=node.width;st.back().cost+=value;}else{width+=node.width;cost+=value;}}
if(st.back().height==h){st.back().width+=width;st.back().cost+=cost;}else st.push_back({h,width,cost});};
for(uint32_t i=0;i<n;i++)append(readNumber(),1);append(0,0);printf("%u\n",st.front().cost);}
'''
MUTANTS=[
 {'name':'错误忽略整板竖涂选项只做横涂','language':'cpp','code':r'''#include <cstdio>
#include <cstdint>
int main(){unsigned n,h,previous=0;uint64_t answer=0;scanf("%u",&n);while(n--){scanf("%u",&h);if(h>previous)answer+=uint64_t(h)-previous;previous=h;}printf("%llu\n",(unsigned long long)answer);}
'''},
 {'name':'错误每次下降都重新从地面计水平费用','language':'cpp','code':REFERENCE.replace('uint64_t(node.cost)+node.height-base','uint64_t(node.cost)+node.height')},
 {'name':'错误每块正高度板都单独竖涂','language':'cpp','code':r'''#include <cstdio>
int main(){unsigned n,h,answer=0;scanf("%u",&n);while(n--){scanf("%u",&h);answer+=h>0;}printf("%u\n",answer);}
'''},
]
EDITORIAL='''## 原始来源与完整输入范围

固定 fastprep/Gemini/gemini-minimum-fence-painting-operations.md 定义相邻宽度1的竖板。竖笔一次从底到顶涂完一整块板；横笔一次在同一高度涂连续若干板的一单位高区域，且横笔只能覆盖尚未涂色的区域。竖笔仍涂整板，原文没有禁止它覆盖已经横涂的部分；不能把横笔的限制错误扩展到竖笔。本题无来源样例，三个公开例均为本站构造，不冒充原始输出。

原源明确 n≥1、高度为非负整数，没有给出数值上限。本站根据原 int[] 参数明确采用非负 signed 32-bit 高度 0..2147483647，这是类型适配而非原文十进制约束。n不额外设小上限，接受现有32MiB标准输入预算内所有合法输入；不存在空数组扩展。标准输入为n及其后恰好n个高度，以空白分隔，可在最后一个数字后直接EOF，也可有LF/CRLF。最短十进制编码下 n=16777212 个一位高度且末尾无换行恰占33554432字节，测试覆盖此边界；这是传输预算推导，不是原题n上限。

公开例：[1,2,1]用两笔：底层横涂全部三板，再竖涂中板（允许覆盖其底层）；[0,0,0]无需操作；[2147483647,2147483647]竖涂两板仅需2笔。

## 区间递推与流式实现

对一段当前基准高度b以上的板，设宽度w、最低高度m。可以w笔全部竖涂；也可以先用m−b笔横涂公共底层，再处理高于m的各个连续子段。因此费用为 min(w, m−b+各子段费用之和)。零高度自然隔开正高度段。

用高度严格递增的单调栈表示尚未关闭的区间，同高节点合并。节点仅存height、width和已经关闭的子段费用cost。新高度h到来时，弹出高于h的节点，父层基准为max(h,弹出后的栈顶高度)，按上述递推结算并累计到父节点。若父层恰是新h，则费用暂存到待插入节点；否则并入已有栈顶。相同高度直接合并宽度/子段费用。最后用宽度0、高度0的虚拟边界关闭剩余节点，不增加板数。高度0哨兵的累计费用即答案。

## 正确性证明

先证明递推下界。若一个区间的所有板都用过竖笔，则操作至少w次。否则存在未用竖笔的板，该板从b到m的每一单位高均必须由横笔涂色，所以至少有m−b次位于这些底层的横笔。高于m的不同连续子段由高度m的板隔开，任何该高度以上的横笔不能跨越这些板；竖笔也只属于一块板。因此扣除公共底层所需的横笔后，各子段仍各自至少需要其最优费用。位于最低板的竖笔或多余底层横笔只能增加费用，不破坏下界。

两种上界都可实现：全部竖涂用w次；或者先横涂全区间的m−b个尚未涂色底层，再分别采用子段最优方案。后续横笔都在未涂色区域，后续竖笔可依原规则涂整板。因此两者较小值就是最优费用。

栈顶弹出意味着它的连续区间已经遇到右侧不更高的边界，左侧更低栈节点与当前h共同确定父层基准。已弹出的更高子段费用已累计到该节点，故其结算正是上述递推。同高合并只合并共享基准的区间，保留总宽度和子段费用，不改变递推。由弹出顺序归纳，所有结算均正确；末尾零边界结算所有正高度区间，哨兵费用因而为整面围栏最优值。

## 复杂度与整数、内存

每块板至多入栈和出栈一次，时间O(n)，栈空间O(n)，流式读取不存高度数组、不递归。答案不超过n（每板至多一笔竖涂），节点width、cost均不超过n；height为非负int32。计算height−base+cost时先提升到uint64，避免高度接近INT_MAX时中间溢出。

参考节点恰12字节，一次reserve(n+1)避免扩容时保留新旧数组。即最大可传输n，所需节点容量也仅201326556字节，低于256MiB；程序不持有输入字符串或第二份n数组。严格递增深栈另以接近预算的多位高度测试。题包时限5秒、内存256MiB，实际Linux沙箱证据由独立验收流程产生，本地记录不冒充服务器结果。

## 独立验证

小域直接建立每个单位格的涂色位图做BFS：竖笔置整板全部位（可重涂），横笔枚举同一行所有连续且尚未涂色的合法片段；求最短到全涂状态。另一个oracle直接枚举区间最小值递推，不使用参考的单调栈。独立BFS穷举n=1..5、高度0..2，区间oracle另穷举n=1..5、高度0..3，并真实运行参考。163唯一小oracle使用BFS或区间枚举，包含固定种子随机数据。完整输入边界采用闭式：全1答案1、严格正升序答案n、零与高板交替答案正板数；大平台和深下降亦独立核算。三负控分别忽略竖笔、错误扣基准、全部单独竖涂，均须在全部正式测试正常退出才计击杀；第一个负控用64位正高度差总和计算纯横涂费用，不使用慢速逐笔模拟。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def interval(a,base=0):
 if not a:return 0
 m=min(a);cost=m-base;start=0
 for i,v in enumerate(a):
  if v==m:cost+=interval(a[start:i],m);start=i+1
 cost+=interval(a[start:],m)
 return min(len(a),cost)
def painting_bfs(a):
 cells={(i,y):j for j,(i,y) in enumerate((i,y) for i,h in enumerate(a) for y in range(h))}
 goal=(1<<len(cells))-1
 if not goal:return 0
 vertical=[sum(1<<cells[i,y] for y in range(h)) for i,h in enumerate(a)]
 queue=deque([(0,0)]);seen={0}
 while queue:
  state,d=queue.popleft();moves=[state|mask for mask in vertical]
  for y in range(max(a)):
   for left in range(len(a)):
    mask=0
    for right in range(left,len(a)):
     j=cells.get((right,y))
     if j is None or state>>j&1:break
     mask|=1<<j;moves.append(state|mask)
  for nxt in moves:
   if nxt==goal:return d+1
   if nxt not in seen:seen.add(nxt);queue.append((nxt,d+1))
 raise AssertionError('unreachable')
def execute(binary,raw):
 t=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=30);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-t,5)
def consecutive_text(n,reverse=False):
 out=io.StringIO();out.write(str(n)+'\n')
 for start in range(0,n,10000):
  values=range(n-start,max(0,n-start-10000),-1) if reverse else range(start+1,min(n,start+10000)+1)
  out.write(' '.join(map(str,values)));out.write(' ' if start+10000<n else '\n')
 return out.getvalue()
def decimal_sum(n):
 total=0;start=1;digits=1
 while start<=n:
  end=min(n,start*10-1);total+=(end-start+1)*digits;start*=10;digits+=1
 return total
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 blob=subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[[1,2,1],[0,0,0],[2147483647]*2,[100,101,101],[2,3,3],[1,2,2],[0],[1],[2],[0,1,0],[2,1,2],[1,3,1,3,1],[2147483647,1,2147483647]]
 rng=random.Random(SEED);keys={encode(a) for a in small}
 while len(small)<163:
  a=[rng.randrange(9) for _ in range(rng.randint(1,10))];s=encode(a)
  if s not in keys:keys.add(s);small.append(a)
 oracles=[{'input':encode(a),'expectedOutput':str(painting_bfs(a) if len(a)<=4 and max(a)<=3 else interval(a))+'\n'} for a in small]
 cases=[];measurements=[]
 def add(name,raw,expected,hidden=True):
  assert len(raw.encode())<=BUDGET
  cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':hidden,'weight':1})
 for i,a in enumerate(small[:28]):add(('本站构造公开例' if i<3 else '独立小域')+str(i+1),encode(a),interval(a),i>=3)
 for n in [1,2,17,999,100000]:
  add(f'全零-{n}',encode([0]*n),0);add(f'极高平台-{n}',encode([2147483647]*n),n)
 add('同高合并长平台',encode([7]*200000),7)
 add('零分隔极高板',encode([0,2147483647]*100000),100000)
 add('低层连接高峰',encode([1,2147483647]*100000),100001)
 add('严格下降深栈对称',consecutive_text(200000,True),200000)
 n=16777212;full=str(n)+'\n'+'1 '*(n-1)+'1';assert len(full)==BUDGET
 add('32MiB-EOF-最多板数全一',full,1);del full
 lo,hi=1,5000000
 while lo<hi:
  mid=(lo+hi+1)//2
  if len(str(mid))+1+decimal_sum(mid)+mid<=BUDGET:lo=mid
  else:hi=mid-1
 deep=lo;add('近32MiB-严格升序最大深栈',consecutive_text(deep),deep)
 print(f'Gemini prepared {len(cases)} formal cases; deepest stack n={deep}; verifying BFS and native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='gemini1-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  bfs_count=0;exhaustive=0
  for n in range(1,6):
   for a in product(range(3),repeat=n):
    expected=painting_bfs(a);assert expected==interval(a);assert execute(binary,encode(a))[0]==str(expected);bfs_count+=1
  for n in range(1,6):
   for a in product(range(4),repeat=n):
    assert execute(binary,encode(a))[0]==str(interval(a));exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  print(f'BFS {bfs_count}, interval exhaustive {exhaustive}, unique oracle {len(oracles)} passed',flush=True)
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if len(case['input'])>100000:
    with tempfile.TemporaryFile(mode='w+') as data:
     data.write(case['input']);data.seek(0);p=subprocess.run(['/usr/bin/time','-l',str(binary)],stdin=data,text=True,capture_output=True,check=True,timeout=30)
    assert p.stdout.strip()==actual;rss=re.search(r'(\d+)\s+maximum resident set size',p.stderr)
    measurements.append({'name':case['name'],'inputBytes':len(case['input'].encode()),'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed,'darwinPeakRssBytes':int(rss.group(1)) if rss else None})
    print(f"formal {case['name']}: {elapsed}s",flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected;kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)});print(f'mutant {i+1}: {len(rejected)} rejected, all normal',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Gemini OA #1：最少围栏涂色操作','difficulty':'困难','tags':['单调栈','动态规划','流式处理'],
 'description':'相邻n块宽度1的竖板，高度为heights[i]。一次竖笔从底到顶涂完一整块板，可覆盖此前已涂部分；一次横笔在同一高度跨连续相邻板涂一单位高，只能覆盖尚未涂色部分。求全部涂完的最少操作数。高度0的板无须涂色。',
 'input':'输入n及n个非负高度，空白分隔，可LF/CRLF或直接EOF。原源n≥1且高度非负，无数字上限；本站依int[]明确高度0..2147483647，n由现有32MiB标准输入预算限制，不另设小上限，不接收空数组。',
 'output':'输出最少操作数（精确整数，无取模），不超过n。',
 'explanation':'原源没有样例，全部公开例为本站构造：[1,2,1]先横涂底层再竖涂中板，共2笔；[0,0,0]为0笔；两块INT_MAX高板各竖涂一次，共2笔。竖笔仍涂整板，只有横笔禁止重复涂色。类型范围与标准输入预算为明确适配，非原文数值上限。',
 'hints':['区间可以全部竖涂，或先横涂到最低高度。','合并等高节点的单调栈可避免最坏平方递归。','高度差与子段费用相加时使用64位中间数。'],
 'timeLimit':5,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'压缩等高单调栈与区间最优递推','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'gitBlobSha':blob,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,'rangeDisclosure':'Original n>=1 and nonnegative heights, no numerical upper bounds. Explicit nonnegative Java int32 height adaptation and complete existing 32MiB stdin transport domain, including EOF max n16777212. No empty array extension.','semanticDisclosure':'Only horizontal strokes are restricted to unpainted portions; vertical strokes paint the entire board and may overlap. No original examples: all public examples authored.','algorithmDisclosure':'Original linear streaming monotonic stack, 12-byte nodes, one fixed reserve, uint64 intermediate; no upstream code executed.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定原文完整区分整板竖涂与仅未涂区域横涂；公开类型和输入预算适配，不缩n为小界。流式线性等高合并栈覆盖全部可传输域，真实涂色BFS与独立区间枚举核验，满EOF输入及深栈闭式验证。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Painting-cell bitmask BFS, independently recursive interval minimum enumeration; large structured closed forms.','exhaustiveSmallDomain':{'paintingBfsCases':bfs_count,'paintingBfsN':[1,5],'paintingBfsHeights':[0,2],'intervalCases':exhaustive,'intervalN':[1,5],'intervalHeights':[0,3]},'largeBoundaries':measurements,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Gemini frozen: {len(cases)} formal, 163 oracle; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
