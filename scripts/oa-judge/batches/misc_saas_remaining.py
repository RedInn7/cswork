"""Audited OA-Master miscellaneous SaaS candidate batch."""
from collections import Counter
from itertools import permutations
from pathlib import Path
import hashlib, heapq, json, random, subprocess
import amazon_remaining_h as helper

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='misc-saas-remaining'
SEED=20261005
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
RAW={
'twilio':('web/content/docs/companies/twilio.mdx','2854338de400f49f6d1abdaf0425109924c3036b','30c47440a75309ff1cbe3846f3014f7428f54fcb6aaf32d65c09df9157bb3520'),
'yahoo':('web/content/docs/companies/yahoo.mdx','ab7f02996e4b97984b744ef759c7603359bc39e6','4551e36e555bd7984bc3d6e9104a4f28f4886038b512b8f21489bd2e7c3ce737'),
'ericsson':('web/content/docs/companies/ericsson.mdx','8fecc3e084ea7b39853376403944744adc8756f5','1b8621068d7a6345050cc0fcef7c4f7c52b33e7626b666a76a3b5a32137d3608'),
'patreon':('web/content/docs/companies/patreon.mdx','07e4c498df0fd1cf878efd3cabb84c3dfd7c60b8','d68cbe6bb1f2f2c5a30612e0ec044bef98c9be1d262c958516682a4604d1126a'),
'waymo':('web/content/docs/companies/waymo.mdx','3c460304f04f49f6d1abdaf8de5a3ab53b80e539','f302c6320666665c68547acd777c5530a8d65cd71669ef918ba0e6882db6d876'),
'zscaler':('web/content/docs/companies/zscaler.mdx','2dd28f98e2698b46e71a6ef8de5a3ab53b80e539','fb1e719b17c7c0a2a9909a05f6b3b244e43bf7b4d02fd5899499d2fdcb02613b'),
'applied-intuition':('web/content/docs/companies/applied-intuition.mdx','3e421a96b87de2620308516499c6a8e3629f0112','2f965b8ecf87dc4baeed83b5c39b7c3bbe83831c115e7d27f7740b856136730e'),
'general-motors':('web/content/docs/companies/general-motors.mdx','061d4807e37eb54bffc2523b6b6497f5ff9783d8','77c004d1b5dda6bf7a84bca7ea5e87a946acaea6db6ccd11e196b9f3d4e4c1df'),
'superhuman':('web/content/docs/companies/superhuman.mdx','3018c7ee6e89127c2ec8b05af3666182191cc8d1','8ef89dfa6474f79408a75faddbcd809af33ac7fdea60a83f1c7b38eb4961f890'),
'service-now':('web/content/docs/companies/service-now.mdx','c0cc61d5c40651bb34aa486155ff63043036aaef','efb9f6d74a0357d0a358249f7e9ed7314c77be6f799d8c6b6516d02f381b07b9'),
'circle':('web/content/docs/companies/circle.mdx','32854434f04a7718ca07c4ee7af71cba07092c1c','1ddbd44c328e1fcd739429e2e616efa6c06ec009e06faf3993729c741a75507d'),
'quora':('web/content/docs/companies/quora.mdx','d0be5285e3218e7834b95c4913d54c9340082632','34c21c00f2882f8c15f6fe2aa447721f8b72dfe93599178747ee49cee8cd95a8')}
def mk(company,num,title,desc,limits,out,samples,enc,oracle,rnd,code,mutants,idea,proof,cost,checker='tokens',bound=2000000,time=5):return locals()
def arr(a):return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def oracle_uniq(s):
 best=''
 for m in range(1<<len(s)):
  t=''.join(s[i] for i in range(len(s)) if m>>i&1)
  if len(t)==len(set(t)) and set(t)==set(s) and t>best:best=t
 return best
def oracle_bin(s):
 a=0
 for l in range(len(s)):
  for r in range(l+1,len(s)+1):
   t=s[l:r]
   if t.count('0')==t.count('1') and t.count('01')+t.count('10')==1:a+=1
 return a
def oracle_top(x):
 a,k=x;c=Counter(a);return ' '.join(map(str,sorted(c,key=lambda v:(-c[v],v))[:k]))
def oracle_half(a):
 cur=set(a);ans=0
 while 1:
  ev=[x for x in cur if x%2==0]
  if not ev:return ans
  x=max(ev);cur.remove(x);cur.add(x//2);ans+=1
def oracle_region(a):
 out=0
 for i,x in enumerate(a):
  best=1
  for l in range(i+1):
   for r in range(i,len(a)):
    if max(a[l:r+1])==x:best=max(best,r-l+1)
  out+=best
 return out
def oracle_decode(s):
 def f(i):
  out=''
  while i<len(s) and s[i]!=')':
   if s[i]!='(':out+=s[i];i+=1
   else:
    t,i=f(i+1);i+=1;j=s.index('}',i+1);k=int(s[i+1:j]);i=j+1;out+=t*k
  return out,i
 return f(0)[0]
def oracle_graph(x):
 n,e,s,t=x;g=[[] for _ in range(n)]
 for a,b,w in e:g[a].append((b,w))
 d=[10**30]*n;d[s]=0;h=[(0,s)]
 while h:
  c,u=heapq.heappop(h)
  if c!=d[u]:continue
  for v,w in g[u]:
   if c+w<d[v]:d[v]=c+w;heapq.heappush(h,(c+w,v))
 return ' '.join(str(z if z<10**30 else -1) for z in (d[v] for v in t))
def oracle_filter(x):
 a,rs=x;return sum(all(l<=v<=h for l,h in rs) for v in a)
def oracle_topo(x):
 ms,ds=x
 for p in permutations(sorted(ms)):
  ix={x:i for i,x in enumerate(p)}
  if all(ix[b]<ix[a] for a,b in ds):return ' '.join(p)
 return 'IMPOSSIBLE'
def oracle_tx(cs):
 d={};stack=[];out=[]
 for c in cs:
  p=c.split();op=p[0]
  if op=='SET':d[p[1]]=p[2]
  elif op=='DELETE':d.pop(p[1],None)
  elif op=='GET':out.append(d.get(p[1],'NULL'))
  elif op=='BEGIN':stack.append(d.copy())
  elif op=='ROLLBACK':
   if stack:d=stack.pop()
   else:out.append('NO TRANSACTION')
  elif op=='COMMIT':
   if stack:stack.pop()
   else:out.append('NO TRANSACTION')
 return '\n'.join(out)
def oracle_notice(x):
 msg,k=x
 if len(msg)<=k:return msg
 best='...';w=msg.split()
 for i in range(1,len(w)+1):
  t=' '.join(w[:i])+' ...'
  if len(t)<=k:best=t
 return best
def dsum(n):return sum(map(int,str(n)))
def oracle_digit(n):
 target=2*dsum(n);x=n+1
 while dsum(x)!=target:x+=1
 return x
def oracle_lost(x):
 a,b=x[0].split(),x[1].split();j=len(b)-1;out=[]
 for w in reversed(a):
  if j>=0 and w==b[j]:j-=1
  else:out.append(w)
 return '\n'.join(reversed(out))
def oracle_home(x):
 a,t=x;ans=[len(a)]
 def walk(i,p):
  vals=[a[j] for j in p]
  if max(vals)-min(vals)>=t:ans[0]=min(ans[0],len(p));return
  for j in (i+1,i+2):
   if j<len(a):walk(j,p+[j])
 walk(0,[0]);return ans[0]
def oracle_transfer(x):
 a,ss,tt=x;n=len(a);d=[[10**20]*n for _ in a]
 for i in range(n):
  d[i][i]=0
  for j in range(n):d[i][j]=abs(a[i]-a[j])
  if n>1:
   k=1 if i==0 else n-2 if i==n-1 else i-1 if a[i]-a[i-1]<a[i+1]-a[i] else i+1
   d[i][k]=1
 for k in range(n):
  for i in range(n):
   for j in range(n):d[i][j]=min(d[i][j],d[i][k]+d[k][j])
 return ' '.join(str(d[i][j]) for i,j in zip(ss,tt))
def randstr(r):return ''.join(r.choice('abcde') for _ in range(r.randint(1,12)))
def randbin(r):return ''.join(r.choice('01') for _ in range(r.randint(1,24)))
def randtop(r):
 a=[r.randint(-8,8) for _ in range(r.randint(1,16))];return a,r.randint(1,len(set(a)))
def randarr(r):return [r.randint(1,256) for _ in range(r.randint(1,12))]
def randregion(r):return [r.randint(1,8) for _ in range(r.randint(1,12))]
def randdecode(r):return f"{randstr(r)[:4]}({randstr(r)[:3]}){{{r.randrange(5)}}}"
def encdecode(x):return str(len(x))+'\n'+'\n'.join(x)+'\n'
def randgraph(r):
 n=r.randint(2,8);e=[(i,j,r.randint(0,20)) for i in range(n) for j in range(n) if r.random()<.2]
 return n,e,r.randrange(n),[r.randrange(n) for _ in range(r.randint(1,n))]
def encgraph(x):
 n,e,s,t=x;return f'{n} {len(e)} {s+1} {len(t)}\n'+''.join(f'{a+1} {b+1} {w}\n' for a,b,w in e)+' '.join(str(i+1) for i in t)+'\n'
def randfilter(r):
 a=[r.randint(-30,30) for _ in range(r.randint(1,16))];rs=[]
 for _ in range(r.randint(1,7)):
  x,y=r.randint(-25,25),r.randint(-25,25);rs.append((min(x,y),max(x,y)))
 return a,rs
def encfilter(x):
 a,rs=x;return f'{len(a)} {len(rs)}\n'+' '.join(map(str,a))+'\n'+''.join(f'{l} {h}\n' for l,h in rs)
def randtopo(r):
 n=r.randint(1,7);ms=[chr(97+i) for i in range(n)];p=ms[:];r.shuffle(p);ix={x:i for i,x in enumerate(p)}
 d=[(a,b) for a in ms for b in ms if ix[b]<ix[a] and r.random()<.2]
 if r.random()<.2 and n>1:d.extend([(ms[0],ms[1]),(ms[1],ms[0])])
 return ms,d
def enctopo(x):
 m,d=x;return f'{len(m)}\n'+' '.join(m)+f'\n{len(d)}\n'+''.join(f'{a} {b}\n' for a,b in d)
def randtx(r):
 cs=[]
 for _ in range(r.randint(6,22)):
  op=r.choice(['SET','GET','DELETE','BEGIN','ROLLBACK','COMMIT']);k='k'+str(r.randrange(4))
  cs.append(f'SET {k} v{r.randrange(6)}' if op=='SET' else f'{op} {k}' if op in ('GET','DELETE') else op)
 cs.append('GET k0');return cs
def enctx(x):return f'{len(x)}\n'+'\n'.join(x)+'\n'
def randnotice(r):
 msg=' '.join(''.join(r.choice('abcd') for _ in range(r.randint(1,7))) for _ in range(r.randint(1,10)))
 return msg,r.randint(3,min(50,len(msg)+8))
def encnotice(x):return f'{x[1]}\n{x[0]}\n'
def randlost(r):
 a=[r.choice(['a','b','c','AA','bb']) for _ in range(r.randint(2,12))];ids=sorted(r.sample(range(len(a)),r.randint(1,len(a)-1)))
 return ' '.join(a),' '.join(a[i] for i in ids)
def randhome(r):
 a=sorted(r.randint(1,30) for _ in range(r.randint(1,10)));return a,r.randint(1,25)
def enchome(x):return f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n'
def randtransfer(r):
 n=r.randint(2,8);a=sorted(r.sample(range(1,200),n));q=r.randint(1,10)
 return a,[r.randrange(n) for _ in range(q)],[r.randrange(n) for _ in range(q)]
def enctransfer(x):
 a,s,t=x;return f'{len(a)} {len(s)}\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,s))+'\n'+' '.join(map(str,t))+'\n'
def randtransfer(r):
 while True:
  a=sorted(r.sample(range(1,200),r.randint(2,8)))
  if all(a[i]-a[i-1]!=a[i+1]-a[i] for i in range(1,len(a)-1)):break
 q=r.randint(1,10);return a,[r.randrange(len(a)) for _ in range(q)],[r.randrange(len(a)) for _ in range(q)]
def pairenc(x):return x[0]+'\n'+x[1]+'\n'
def add(*x):S.append(mk(*x))
S=[]
add('twilio',2,'Find Maximum Greatness','重新排列数组，最大化 rearranged[i] > arr[i] 的下标数。','n≤100000，数组值 1..10^9。','输出最大值。',[([1,3,5],),([1,1,1],),([1,2,2,3],)],lambda x:arr(x[0]),lambda x:max(sum(p[i]>x[0][i] for i in range(len(p))) for p in permutations(x[0])),lambda r:([r.randint(1,8) for _ in range(r.randint(1,7))],),"""def solve(raw):
 v=list(map(int,raw.split()));n=v[0];a=sorted(v[1:n+1]);i=0
 for z in a:
  if i<n and z>a[i]:i+=1
 return str(i)
""",[('strict inequality','z>a[i]','z>=a[i]'),('descending sort','a=sorted(v[1:n+1])','a=sorted(v[1:n+1],reverse=True)')],'排序并贪心匹配最小可行的严格较大元素。','最小可行匹配不浪费更大的元素，贪心最大化可匹配对数。','O(n log n) time, O(n) space.')
add('yahoo',1,'Modify the String','删除重复字符直到字符互异，返回字典序最大的保序结果。','小写字母字符串，长度 1..100000。','输出最大去重子序列。',['aabcb','bcabc','aaaa','cbacdcbc'],lambda x:x+'\n',lambda x:oracle_uniq(x),randstr,"""def solve(raw):
 s=raw.strip();left={c:s.count(c) for c in set(s)};st=[];inside=set()
 for c in s:
  left[c]-=1
  if c in inside:continue
  while st and st[-1]<c and left[st[-1]]>0:inside.remove(st.pop())
  st.append(c);inside.add(c)
 return ''.join(st)
""",[('reversed comparison','st[-1]<c','st[-1]>c'),('require too many future copies','left[st[-1]]>0','left[st[-1]]>1')],'单调栈遇到较大字符时弹出仍会出现的较小字符。','被弹出的字符有后续副本可补回；当前较大字符前移提升字典序；不能补回的字符保留。','O(n) time, O(σ) space.')
add('yahoo',2,'Count Binary Substrings','统计由相邻两段等长连续 0/1 组成的子串，按位置分别计数。','二进制串，长度 1..100000。','输出合法子串数。',['011001','0011','10101','000111'],lambda x:x+'\n',lambda x:oracle_bin(x),randbin,"""def solve(raw):
 s=raw.strip();prev=run=0;last=None;ans=0
 for c in s:
  if c==last:run+=1
  else:ans+=min(prev,run);prev,run=run,1;last=c
 return str(ans+min(prev,run))
""",[('use max instead','min(prev,run)','max(prev,run)'),('omit last pair','ans+min(prev,run)','ans')],'压缩连续字符段，相邻段贡献长度较小值。','合法子串恰跨相邻两段且长度相等，可选起点数为较小段长度。','O(n) time, O(1) space.')
add('ericsson',2,'Top K Frequent Elements','按频次降序、数值升序输出 k 个高频元素。','n≤100000, −10000≤x≤10000, 1≤k≤distinct。输入 n k 和数组。','输出 k 个整数。',[([1,1,1,2,2,3],2),([4,5,2,1,3],5),([-1,-1,2,2,0],2)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle_top,randtop,"""def solve(raw):
 v=list(map(int,raw.split()));n,k=v[:2];c={}
 for x in v[2:n+2]:c[x]=c.get(x,0)+1
 return ' '.join(map(str,sorted(c,key=lambda x:(-c[x],x))[:k]))
""",[('frequency ascending','(-c[x],x)','(c[x],x)'),('tie value descending','(-c[x],x)','(-c[x],-x)')],'统计频次后按 (-频次, 数值) 排序。','该排序键逐项满足频次优先与平手数值较小优先。','O(n+d log d) time, O(d) space.')
add('patreon',1,'Minimize Computation Time','每次将当前所有等于偶数 c 的值同时减半，求使所有值为奇数的最少操作数。','n≤200000，正整数值≤10^9（本站补充）。','输出操作数。',[[2,4,8,16],[3,5,7],[2,2,4,4],[6,12,3]],arr,lambda x:oracle_half(x),lambda r:[r.randint(1,256) for _ in range(r.randint(1,12))],"""def solve(raw):
 v=list(map(int,raw.split()));cur=set(v[1:v[0]+1]);ans=0
 while True:
  e=[x for x in cur if x%2==0]
  if not e:return str(ans)
  x=max(e);cur.remove(x);cur.add(x//2);ans+=1
""",[('process smallest even first','x=max(e)','x=min(e)'),('count each layer separately','cur.remove(x);cur.add(x//2);ans+=1','cur.remove(x);cur.add(x//2);ans+=v[1:v[0]+1].count(x)')],'对每种当前偶数值只操作一次，因为同值层会同时变换。','每个出现过的偶数状态必须被处理一次；每次处理令该值所有层一起减半，故状态集合迭代恰好计数必要操作。','O(n log A) time, O(n) space.')
add('patreon',2,'Sum of Subarray Regions','每个位置 region 是包含它且该位置高度仍为最大值的最长连续区间；相等高度仍是最大值。','n≤100000，高度 1..10^9。','输出所有 region 长度之和。',[[3,5,6],[5,5],[2,1,2],[1,3,2,4]],arr,lambda x:oracle_region(x),randregion,"""def solve(raw):
 v=list(map(int,raw.split()));a=v[1:v[0]+1];n=len(a);L=[-1]*n;R=[n]*n;st=[]
 for i,x in enumerate(a):
  while st and a[st[-1]]<=x:st.pop()
  if st:L[i]=st[-1]
  st.append(i)
 st=[]
 for i in range(n-1,-1,-1):
  while st and a[st[-1]]<=a[i]:st.pop()
  if st:R[i]=st[-1]
  st.append(i)
 return str(sum(R[i]-L[i]-1 for i in range(n)))
""",[('equal height blocks','a[st[-1]]<=x','a[st[-1]]<x'),('omit left boundary','R[i]-L[i]-1','R[i]-i')],'单调栈找到左右最近的严格更高高度。','合法区间不能越过更高位置；两边界内部均以当前值为最大，整个区间即最长。','O(n) time, O(n) space.')
add('waymo',1,'Decode Repeated Groups','解码小写字母及 (substring){k} 重复组，允许嵌套和 k=0。','q 行编码串；本站补充每串及解码长度≤200000、深度≤1000。','逐行输出解码串。', [['abs(cs){3}g','a(b(c){2}){2}','x(yz){0}q'],['a(b){0}c'],['(ab){2}']],lambda x:str(len(x))+'\n'+'\n'.join(x)+'\n',lambda x:'\n'.join(oracle_decode(s) for s in x),lambda r:[f"a({randstr(r)[:3]}){{{r.randrange(5)}}}" for _ in range(r.randint(1,5))],"""def dec(s):
 st=[''];i=0
 while i<len(s):
  if s[i]=='(':st.append('');i+=1
  elif s[i]==')':
   t=st.pop();i+=2;j=i
   while s[j].isdigit():j+=1
   k=int(s[i:j]);i=j+1;st[-1]+=t*k
   if len(st[-1])>200000:raise ValueError('output too long')
  else:st[-1]+=s[i];i+=1
 return st[0]
def solve(raw):
 v=raw.splitlines();return '\\n'.join(dec(x) for x in v[1:1+int(v[0])])
""",[('ignore multiplier','st[-1]+=t*k','st[-1]+=t'),('discard nested result','st[-1]+=t*k','st[-1]+=""')],'用显式栈累积每层内容；关闭括号时将子串按次数追加到父层。','每一组按定义从内到外重复子串并拼接，栈归约与嵌套语法的递归求值一致。','O(output length) time and space.')
add('waymo',2,'Shortest Paths to Multiple Targets','有向非负权图上求 source 到多目标最短路，不可达为 -1。','n≤200000,m≤300000, w≤10^9；节点 1-based，输入 n m source q、边、目标。','依序输出目标距离。',[(5,[(0,1,2),(0,2,5),(1,2,1),(1,3,2),(2,4,1),(3,4,2)],0,[2,3,4]),(4,[(0,1,5)],0,[1,2]),(3,[(1,0,0),(0,2,0)],1,[0,2])],encgraph,oracle_graph,randgraph,"""import heapq
def solve(raw):
 v=list(map(int,raw.split()));n,m,s,q=v[:4];p=4;g=[[] for _ in range(n)]
 for _ in range(m):
  a,b,w=v[p]-1,v[p+1]-1,v[p+2];p+=3;g[a].append((b,w))
 ts=[x-1 for x in v[p:p+q]];d=[10**30]*n;d[s-1]=0;h=[(0,s-1)]
 while h:
  x,u=heapq.heappop(h)
  if x!=d[u]:continue
  for z,w in g[u]:
   if x+w<d[z]:d[z]=x+w;heapq.heappush(h,(x+w,z))
 return ' '.join(str(d[z] if d[z]<10**30 else -1) for z in ts)
""",[('reverse directed edges','g[a].append((b,w))','g[b].append((a,w))'),('wrong source distance','d[s-1]=0','d[s-1]=1')],'从 source 运行 Dijkstra 并按询问返回距离。','非负权保证 Dijkstra 的出队最短路不再改进；松弛枚举所有可达路，仍为无穷即不可达。','O((n+m) log n) time, O(n+m) space.')
add('zscaler',2,'Signal Filter','信号需同时落入所有闭区间；统计通过全部滤波器的频率。','n,m≤100000；频率、端点为 32 位整数。输入 n m、频率及 m 个区间。','输出通过数量。',[([8,15,14,16,21],[(10,17),(13,15),(13,17)]),([0,10,20],[(-1,30),(0,20)]),([1,2,3],[(4,9)])],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{l} {h}\n' for l,h in x[1]),oracle_filter,lambda r:([r.randint(-30,30) for _ in range(r.randint(1,16))],[(lambda a,b:(min(a,b),max(a,b)))(r.randint(-25,25),r.randint(-25,25)) for _ in range(r.randint(1,7))]),"""def solve(raw):
 v=list(map(int,raw.split()));n,m=v[:2];a=v[2:2+n];lo=max(v[2+n+2*i] for i in range(m));hi=min(v[3+n+2*i] for i in range(m))
 return str(sum(lo<=x<=hi for x in a))
""",[('exclusive upper bound','lo<=x<=hi','lo<=x<hi'),('union bounds','lo=max(v[2+n+2*i] for i in range(m));hi=min(v[3+n+2*i] for i in range(m))','lo=min(v[2+n+2*i] for i in range(m));hi=max(v[3+n+2*i] for i in range(m))')],'交集为最大左界至最小右界，遍历统计落入闭区间的频率。','一个数满足所有区间，当且仅当不小于每个下界且不大于每个上界。','O(n+m) time, O(1) extra space.')
add('applied-intuition',1,'Compilation Order with Topological Sort','依赖 [module, prerequisite] 表示 prerequisite 先编译；每次从可编译模块选字典序最小者。存在环返回 IMPOSSIBLE。','互异无空格模块名；n,m≤200000，依赖成对输入。','输出编译顺序或 IMPOSSIBLE。',[(['app','core','util'],[('app','core'),('core','util')]),(['b','a','c'],[]),(['a','b'],[('a','b'),('b','a')])],lambda x:f'{len(x[0])}\n'+' '.join(x[0])+f'\n{len(x[1])}\n'+''.join(f'{a} {b}\n' for a,b in x[1]),oracle_topo,lambda r:(lambda m:(m,[(a,b) for a in m for b in m if a>b and r.random()<.2]))([chr(97+i) for i in range(r.randint(1,7))]),"""import heapq
def solve(raw):
 v=raw.split();p=0;n=int(v[p]);p+=1;ms=v[p:p+n];p+=n;m=int(v[p]);p+=1;g={x:[] for x in ms};d={x:0 for x in ms}
 for _ in range(m):
  a,b=v[p:p+2];p+=2;g[b].append(a);d[a]+=1
 h=[x for x in ms if d[x]==0];heapq.heapify(h);out=[]
 while h:
  x=heapq.heappop(h);out.append(x)
  for y in g[x]:
   d[y]-=1
   if d[y]==0:heapq.heappush(h,y)
 return ' '.join(out) if len(out)==n else 'IMPOSSIBLE'
""",[('not lexicographic','heapq.heappop(h)','h.pop(0)'),('reverse dependency','g[b].append(a);d[a]+=1','g[a].append(b);d[b]+=1')],'Kahn 拓扑排序，用最小堆决定同一时刻可选模块。','入度归零表示所有前置依赖均完成；每步取最小可选项实现字典序规则，结果少于 n 则存在环。','O((n+m) log n) time, O(n+m) space.')
add('applied-intuition',2,'KV Store with Nested Transactions','实现 SET/GET/DELETE 和嵌套 BEGIN/ROLLBACK/COMMIT；缺失 GET 为 NULL；无事务提交/回滚输出 NO TRANSACTION。','q≤200000 行；键和值不含空格。','输出 GET 结果和无事务错误。',[['SET x 1','BEGIN','SET x 2','GET x','ROLLBACK','GET x'],['GET miss','COMMIT','ROLLBACK'],['SET a z','BEGIN','DELETE a','BEGIN','SET b y','COMMIT','GET b','ROLLBACK','GET a']],lambda x:f'{len(x)}\n'+'\n'.join(x)+'\n',oracle_tx,lambda r:[(lambda a:a+['GET k0'])([ (lambda op,k: f'SET {k} v{r.randrange(4)}' if op=='SET' else f'{op} {k}' if op in ('GET','DELETE') else op)(r.choice(['SET','GET','DELETE','BEGIN','ROLLBACK','COMMIT']),'k'+str(r.randrange(4))) for _ in range(12)]),][0],"""def solve(raw):
 v=raw.splitlines();q=int(v[0]);base={};layers=[];out=[]
 def get(k):
  for d in reversed(layers):
   if k in d:return d[k]
  return base.get(k)
 for c in v[1:q+1]:
  p=c.split();op=p[0]
  if op=='SET':(layers[-1] if layers else base)[p[1]]=p[2]
  elif op=='DELETE':(layers[-1] if layers else base)[p[1]]=None
  elif op=='GET':
   x=get(p[1]);out.append('NULL' if x is None else x)
  elif op=='BEGIN':layers.append({})
  elif op=='ROLLBACK':
   if layers:layers.pop()
   else:out.append('NO TRANSACTION')
  elif op=='COMMIT':
   if not layers:out.append('NO TRANSACTION')
   else:(layers[-2] if len(layers)>1 else base).update(layers.pop())
 return '\\n'.join(out)
""",[('drop committed data','else:(layers[-2] if len(layers)>1 else base).update(layers.pop())','else:layers.pop()'),('rollback applies data','if layers:layers.pop()','if layers:(layers[-2] if len(layers)>1 else base).update(layers.pop())')],'事务层记录键变更，GET 从内向外查找；提交将本层覆盖合并到父层，回滚丢弃本层。','最新事务层的值优先；提交保留其变更，回滚恢复进入事务前状态。','read O(depth), writes amortized O(1), space O(q).')
add('general-motors',1,'Prepare Notification','消息超长时保留最长完整单词前缀并加空格和省略号；否则原样返回；首词放不下时输出省略号。','3≤K≤500，消息 1..500 字符，字母和单空格。第一行 K，第二行消息。','输出长度≤K的通知。',[('And now here is my secret',15),('There is an animal with four legs',15),('super dog',4),('how are you',20)],lambda x:f'{x[1]}\n{x[0]}\n',oracle_notice,lambda r:(' '.join(''.join(r.choice('abcd') for _ in range(r.randint(1,7))) for _ in range(r.randint(1,10))),r.randint(3,40)),"""def solve(raw):
 v=raw.splitlines();k=int(v[0]);msg=v[1]
 if len(msg)<=k:return msg
 out=[]
 for w in msg.split():
  t=' '.join(out+[w])+' ...'
  if len(t)>k:break
  out.append(w)
 return ' '.join(out)+' ...' if out else '...'
""",[('ellipsis off-by-one','if len(t)>k:break','if len(t)-1>k:break'),('truncate words','if len(msg)<=k:return msg','return msg[:k]')],'依次试加完整单词，仅保留加省略号后不超 K 的最长前缀。','前缀长度单调递增，首个超限后更长前缀均不可行；整词规则要求不可截断字符。','O(|message|) time, O(|message|) space.','exact')
add('general-motors',2,'Smallest Greater Number with Double Digit Sum','找最小 X>Z，使 digitSum(X)=2×digitSum(Z)。','1≤Z≤500。','输出 X。',[10,14,99,1,500],lambda x:f'{x}\n',oracle_digit,lambda r:r.randint(1,500),"""def ds(x):
 s=0
 while x:s+=x%10;x//=10
 return s
def solve(raw):
 z=int(raw);target=2*ds(z);x=z+1
 while ds(x)!=target:x+=1
 return str(x)
""",[('skip first candidate','x=z+1','x=z+2'),('wrong target','target=2*ds(z)','target=ds(z)')],'从 Z+1 递增枚举检查数字和。','枚举顺序严格递增，所以首次符合条件的数最小；全域穷举确认范围内总有解。','O((X−Z)·digits) time, O(1) space.')
add('superhuman',1,'Lost Messages','received 为 sent 的词级子序列；输出 sent 中未收到的词，保持顺序。','两行英文词串，单空格分词；received 是 sent 的严格较短子序列。','逐行输出丢失词；无词输出空行。',[('I am a programmer','I programmer'),('we love coding daily','we coding'),('alpha beta gamma delta','alpha delta'),('x x y x','x x')],lambda x:x[0]+'\n'+x[1]+'\n',oracle_lost,randlost,"""def solve(raw):
 a,b=raw.splitlines();s=a.split();r=b.split();j=0;o=[]
 for w in s:
  if j<len(r) and w==r[j]:j+=1
  else:o.append(w)
 return '\\n'.join(o)
""",[('case insensitive','w==r[j]','w.lower()==r[j].lower()'),('ignore repeated order','if j<len(r) and w==r[j]','if w in r')],'双指针匹配收到的词；sent 中其他词即遗漏。','received 保序为子序列，匹配其最早尚未匹配位置不会错过可匹配项。','O(n+m) time, O(n) space.','exact')
add('superhuman',2,'Math Homework','从下标 0 出发，每步 +1 或 +2；首次已解分值跨度达到 threshold 停；若无路可达则按题意解完整数组。','points 非降序，n≤100000，值和 threshold 在 1..999。','输出最少题数，无法达到时输出 n。',[([1,2,3,5,8],4),([1,2,3,4,5],4),([4,5,6,7],10),([1],1)],enchome,oracle_home,randhome,"""def solve(raw):
 v=list(map(int,raw.split()));n,t=v[:2];a=v[2:n+2];i=0;c=1
 while a[i]-a[0]<t:
  if i+2<n:i+=2
  elif i+1<n:i+=1
  else:return str(n)
  c+=1
 return str(c)
""",[('advance one','if i+2<n:i+=2','if i+2<n:i+=1'),('wrong threshold direction','a[i]-a[0]<t','a[i]-a[0]>t')],'因分值非降，跨度随最后下标单调增长；每次 +2 用最少步到达最远位置。','任意路径每步最多跨两格，达到任一下标 j 至少需要 ceil(j/2) 步；连续跳两格达到该下界。','O(n) time, O(1) space.')
add('superhuman',3,'Optimal Transfer','容量升序且互异；任意直连费用为容量差，连最近服务器费用为 1；回答 0-based 查询。','n,q≤200000，容量≤10^9，最近服务器唯一。','依次输出最小连接费用。',[([2,7,10],[0,1,2],[2,2,1]),([1,4,9,15],[0,3,1],[3,0,3]),([5,6,20],[2,0],[0,1])],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n'+' '.join(map(str,x[2]))+'\n',oracle_transfer,randtransfer, """def solve(raw):
 v=list(map(int,raw.split()));n,q=v[:2];a=v[2:2+n];s=v[2+n:2+n+q];t=v[2+n+q:2+n+2*q];R=[0]*n;L=[0]*n
 for i in range(n):
  if i+1<n:R[i]=1 if i==0 or a[i+1]-a[i]<a[i]-a[i-1] else a[i+1]-a[i]
  if i:L[i]=1 if i==n-1 or a[i]-a[i-1]<a[i+1]-a[i] else a[i]-a[i-1]
 pr=[0]*(n+1);pl=[0]*(n+1)
 for i in range(n):pr[i+1]=pr[i]+R[i];pl[i+1]=pl[i]+L[i]
 return ' '.join(str(pr[b]-pr[a] if a<b else pl[a+1]-pl[b+1] if a>b else 0) for a,b in zip(s,t))
""",[('ignore nearest shortcut','R[i]=1 if','R[i]=a[i+1]-a[i] if'),('choose farther server','a[i+1]-a[i]<a[i]-a[i-1]','a[i+1]-a[i]>a[i]-a[i-1]')],'为每个相邻方向边取最近捷径价 1 或直接容量差，方向前缀和答询。','直连跨越多段的费用是间隙和；沿链将最近邻间隙替换为 1 不会更贵，且路径穿越每段至少一次，故前缀边价总和最优。','O(n+q) time, O(n) space.')

S=[s for s in S if not (s['company']=='superhuman' and s['num']==1)]
BLOCKED={
'oa-twilio-1':'核心目标可定义，但固定源解法对每个查询遍历全部标签，无法满足题面 n,q≤10^5；本批不发布明显超限解。',
'oa-ericsson-1':'合法 numRows 仅 0..30，只有 31 种输入；无法满足至少 120 个互异有效 oracle case，不以空白变体凑数。',
'oa-quora-1':'固定上游题面在“Given an array and a value k, find”处截断，目标运算缺失。',
'oa-quora-2':'只有淘汰顺序示意，输入输出结构、得分累计方式与并列后处理缺正式定义。',
'oa-service-now-1':'题目要求同一组 K 个下标最大化两数组和的较小值，但未给范围；一般是双目标子集优化，无法设置可靠在线限制。',
'oa-service-now-2':'balanced 条件使用等式且索引关系模糊，与常见版本的不等式定义冲突；缺约束和消歧例。',
'oa-circle-1':'重复 taskId、排序规则与 GET_TASKS 精确输出只以建议/测试想法描述，无法唯一实现。',
'oa-circle-2':'quota 失败输出协议、重复任务 ID 与零时长边界不完整，只有建议性测试想法。',
'oa-zscaler-1':'未说明句中词不在 wordSet 时的行为，也未唯一确定替换词候选范围。',
'oa-superhuman-1':'received 可在 sent 中有多种词级子序列对齐，例如 sent="x x y x", received="x x"；题面未规定匹配哪次出现，返回的缺词序列不唯一。'}
def main():
 for f in ['packages','references','oracles','mutants','negative-controls','editorials','candidate-batches','validation','reviews','source-evidence']:(OUT/f).mkdir(parents=True,exist_ok=True)
 cat=json.loads((ROOT/'content/oa-master/catalog.json').read_text());by={x['id']:x for x in cat['items']};batch=[];val=[];rev=[];evi=[]
 for s in S:
  ident=f"oa-{s['company']}-{s['num']}";src=by[ident];code=s['code']+'\nif __name__ == "__main__":\n import sys\n print(solve(sys.stdin.read()))\n'
  rng=random.Random(SEED+s['num']+sum(map(ord,s['company'])));cases=list(s['samples']);seen={json.dumps(x,sort_keys=True) for x in cases}
  for _ in range(20000):
   if len(cases)>=163:break
   x=s['rnd'](rng);key=json.dumps(x,sort_keys=True)
   if key not in seen:seen.add(key);cases.append(x)
  if len(cases)<120:raise ValueError((ident,len(cases)))
  formal=cases[:40];ins=[s['enc'](x) for x in cases];exp=[str(s['oracle'](x))+'\n' for x in cases]
  ref=OUT/'references'/f'{ident}.py';ref.write_text(code);got=helper.execute(ref,ins)
  cmp=(lambda x:x.rstrip('\r\n')) if s['checker']=='exact' else (lambda x:x.split())
  for i,(a,b) in enumerate(zip(got,exp)):
   if cmp(a)!=cmp(b):raise AssertionError((ident,i,repr(a),repr(b),cases[i]))
  muts=[];killed=[]
  for mi,(name,old,new) in enumerate(s['mutants'],1):
   if old not in code:raise ValueError((ident,'mutation missing',old))
   badcode=code.replace(old,new,1);p=OUT/'negative-controls'/f'{ident}-{mi}.py';p.write_text(badcode)
   gotbad=helper.execute(p,[s['enc'](x) for x in formal]);dead=[]
   for i,(a,x) in enumerate(zip(gotbad,formal)):
    if cmp(a)!=cmp(str(s['oracle'](x))+'\n'):dead.append(i)
   if not dead:raise AssertionError((ident,'surviving mutant',name))
   muts.append(dict(name=name,code=badcode));killed.append(dict(name=name,rejectedByCases=dead))
  tests=[dict(name='样例 '+str(i+1) if i<len(s['samples']) else '隐藏用例 '+str(i-len(s['samples'])+1),input=s['enc'](x),expectedOutput=str(s['oracle'](x))+'\n',hidden=i>=len(s['samples']),weight=1) for i,x in enumerate(formal)]
  pkg=dict(schemaVersion=1,problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA',src['companyName']],description=s['desc']+'\n\n本站补充的标准输入输出约定和约束见“输入”。',input=s['limits'],output=s['out'],explanation=s['idea'],hints=[s['idea']],timeLimit=s['time'],memoryLimit=262144,outputLimit=16384,checker=s['checker'],languages=['python','go','java','cpp']),cases=tests)
  raw=json.dumps(pkg,ensure_ascii=False,separators=(',',':'));res=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=raw,text=True,capture_output=True)
  if res.returncode:raise RuntimeError((ident,res.stderr[:2000]))
  norm=res.stdout;(OUT/'packages'/f'{ident}.json').write_text(json.dumps(json.loads(norm),ensure_ascii=False,indent=2)+'\n');(OUT/'oracles'/f'{ident}.json').write_text(json.dumps([dict(input=i,expectedOutput=e) for i,e in zip(ins,exp)],ensure_ascii=False,indent=2)+'\n');(OUT/'mutants'/f'{ident}.json').write_text(json.dumps(muts,ensure_ascii=False,indent=2)+'\n')
  editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}"
  (OUT/'editorials'/f'{ident}.json').write_text(json.dumps(dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=[dict(language='python',code=code)],sourceUrl=src['sourceUrl'],sourceContentHash=src['contentHash'],author='CSWork'),ensure_ascii=False,indent=2)+'\n')
  batch.append(dict(id=ident,sourceContentHash=src['contentHash'],packageChecksum=hashlib.sha256(norm.encode()).hexdigest(),editorial=editorial,authoredSolutions=[dict(language='python',code=code)]))
  val.append(dict(id=ident,oracleCases=len(cases),publicCases=len(s['samples']),hiddenCases=len(formal)-len(s['samples']),maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
  why='逐题审阅固定上游公司 MDX；参考实现与独立 oracle 对照 163 个互异输入，并以两个正常退出错误实现验证正式样例。离线验证尚未运行 GoJudge。'
  rev.append(dict(id=ident,status='authored',reason=why));p,b,_=RAW[s['company']];evi.append(dict(id=ident,catalogContentHash=src['contentHash'],sourceUrl=src['sourceUrl'],status='authored',reason=why,path=p,gitBlobSha=b))
  print(ident,'163 unique oracle cases, 2 mutants killed',flush=True)
 for ident,why in BLOCKED.items():
  src=by[ident];p,b,_=RAW[src['companySlug']];rev.append(dict(id=ident,status='blocked',reason=why));evi.append(dict(id=ident,catalogContentHash=src['contentHash'],sourceUrl=src['sourceUrl'],status='blocked',reason=why,path=p,gitBlobSha=b))
 for a in (batch,val,rev,evi):a.sort(key=lambda x:x['id'])
 pages=[dict(company=c,path=p,gitBlobSha=b,sha256=sha) for c,(p,b,sha) in sorted(RAW.items())]
 (OUT/'candidate-batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=batch),ensure_ascii=False,indent=2)+'\n')
 (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=val,skipped=BLOCKED,note='离线独立 oracle 与正常退出 mutant 验证；不是 GoJudge 结果。'),ensure_ascii=False,indent=2)+'\n')
 (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=rev),ensure_ascii=False,indent=2)+'\n')
 (OUT/'source-evidence'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,repository='https://github.com/RedInn7/OA-Master',commit=COMMIT,reason='固定上游页面证据；未执行上游解法。',pages=pages,items=evi),ensure_ascii=False,indent=2)+'\n')
 print('authored',len(batch),'blocked',len(BLOCKED))
if __name__=='__main__':main()
