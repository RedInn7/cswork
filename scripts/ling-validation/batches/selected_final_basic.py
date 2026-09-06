"""Independent authored fixtures for three remaining string/range problems."""
import inspect,itertools,json,heapq,string
from collections import deque

IDS=[1202,784,632]

def oracle(pid,args):
 if pid==1202:
  s,pairs=args;seen={s};todo=deque([s])
  while todo:
   s=todo.popleft()
   for i,j in pairs:
    a=list(s);a[i],a[j]=a[j],a[i];t=''.join(a)
    if t not in seen:seen.add(t);todo.append(t)
  return min(seen)
 if pid==784:
  return sorted(''.join(p) for p in itertools.product(*[(c.lower(),c.upper()) if c.isalpha() else (c,) for c in args[0]]))
 nums=args[0];values=sorted(set(itertools.chain.from_iterable(nums)))
 return list(min(((a,b) for a in values for b in values if a<=b and all(any(a<=v<=b for v in row) for row in nums)),key=lambda pair:(pair[1]-pair[0],pair[0])))

def fast(pid,args,bug=0):
 if pid==1202:
  s,pairs=args;n=len(s);g=[[] for _ in s]
  if bug==1:
   a=list(s)
   for i,j in pairs:
    if i>j:i,j=j,i
    if a[i]>a[j]:a[i],a[j]=a[j],a[i]
   return ''.join(a)
  for i,j in pairs:g[i].append(j);g[j].append(i)
  seen=set();out=list(s)
  for start in range(n):
   if start in seen:continue
   seen.add(start);stack=[start];component=[]
   while stack:
    i=stack.pop();component.append(i)
    for j in g[i]:
     if j not in seen:seen.add(j);stack.append(j)
   for i,c in zip(sorted(component),sorted((s[i] for i in component),reverse=bug==2)):out[i]=c
  return ''.join(out)
 if pid==784:
  out=['']
  for c in args[0]:
   options=[c] if c.isdigit() else [c.lower(),c.upper()]
   if bug==1:options=[c.lower()]
   out=[s+t for s in out for t in options]
  return sorted(out[:-1] if bug==2 else out)
 nums=args[0];heap=[(row[0],i,0) for i,row in enumerate(nums)];heapq.heapify(heap)
 right=max(row[0] for row in nums);best=[heap[0][0],right]
 while True:
  left,i,j=heapq.heappop(heap)
  if (right-left,left if bug!=2 else -left)<(best[1]-best[0],best[0] if bug!=2 else -best[0]):best=[left,right]
  if bug==1 or j+1==len(nums[i]):return best
  v=nums[i][j+1];right=max(right,v);heapq.heappush(heap,(v,i,j+1))

def validate(pid,a):
 assert type(a)is list
 if pid==1202:
  assert len(a)==2 and type(a[0])is str and 1<=len(a[0])<=100000 and all(c in string.ascii_lowercase for c in a[0])
  assert type(a[1])is list and len(a[1])<=100000
  assert all(type(p)is list and len(p)==2 and all(type(v)is int and 0<=v<len(a[0]) for v in p) for p in a[1])
 elif pid==784:assert len(a)==1 and type(a[0])is str and 1<=len(a[0])<=12 and all(c in string.ascii_letters+string.digits for c in a[0])
 else:
  assert len(a)==1 and type(a[0])is list and 1<=len(a[0])<=3500
  assert all(type(row)is list and 1<=len(row)<=50 and all(type(v)is int and -100000<=v<=100000 for v in row) and row==sorted(row) for row in a[0])
 return True

def random_args(pid,r):
 if pid==1202:
  n=r.randint(1,7);return [''.join(r.choices('abcd',k=n)),[[r.randrange(n),r.randrange(n)] for _ in range(r.randint(0,9))]]
 if pid==784:return [''.join(r.choices('aAzZ09',k=r.randint(1,8)))]
 return [[sorted(r.choices(range(-8,9),k=r.randint(1,5))) for _ in range(r.randint(1,5))]]

EDGE={1202:[['dcab',[[0,3],[1,2]]],['cba',[[0,1],[1,2]]],['z',[]],['baba',[[0,1],[0,1],[2,2]]]],784:[['a1B2'],['123'],['Z'],['aa']],632:[[[[4,10,15,24,26],[0,9,12,20],[5,18,22,30]]],[[[1,3],[2,4]]],[[[-10]]],[[[1,1],[1],[1,2]]]]}
PRESSURE={1202:[(['z'*50000+'a'*50000,[[i,i+1] for i in range(99999)]+[[0,0]]],'a'*50000+'z'*50000),(['z'*100000,[]],'z'*100000)],784:[(['a'*12],sorted(''.join(p) for p in itertools.product('aA',repeat=12)))],632:[([[list(range(-100000,-99950)) for _ in range(3500)]],[-100000,-100000]),([[[i]*50 for i in range(3500)]],[0,3499])]}
META={1202:('smallestStringWithSwaps','可交换字符的最小字符串','Smallest String with Allowed Swaps','可以任意次交换pairs指定的两个位置，返回字典序最小的字符串。','Swap positions named by any pair any number of times; return the lexicographically smallest reachable string.','JSON参数数组[s,pairs]。s为1–100000个小写英文字母；pairs有0–100000对有效下标，可重复或自环。','JSON arguments [s,pairs]. The string has 1–100000 lowercase English letters; pairs has 0–100000 valid index pairs, including repeats and self-pairs.'),784:('letterCasePermutation','字母大小写全排列','Letter Case Permutations','每个英文字母独立选择大写或小写，数字不变，输出所有不同字符串，顺序不限。','Independently choose either case for every English letter, leaving digits unchanged. Return every distinct resulting string in any order.','JSON参数数组[s]；s长度1–12，只含大小写英文字母和数字。','JSON arguments [s]; s has 1–12 English letters or digits.'),632:('smallestRange','覆盖所有列表的最小区间','Smallest Range Covering All Lists','返回闭区间[a,b]，使每个列表至少有一个数在区间内。先最小化b-a，再最小化a。','Find a closed interval [a,b] containing at least one value from every list. Minimize b-a, breaking ties by smaller a.','JSON参数数组[nums]；列表数1–3500，每个列表1–50个非递减整数，数值在[-100000,100000]。','JSON arguments [nums]; there are 1–3500 nondecreasing lists, each containing 1–50 integers in [-100000,100000].')}
WRONG={1202:['只做一轮交换','连通分量错误降序'],784:['只返回小写','漏掉最后一种排列'],632:['仅检查各列表首项','长度相同时选择右侧区间']}

def make(pid):
 method,zh,en,dz,de,iz,ie=META[pid];parse='args=json.load(sys.stdin)'
 # Explicit import lives in parse so generated reference does not rely on prefix.
 parse='import json\n'+parse
 kind='string' if pid==1202 else 'string-set' if pid==784 else 'integer-array'
 emit='print(result)' if pid==1202 else 'print(len(result))\nprint("\\n".join(result))' if pid==784 else 'print(len(result));print(*result)'
 return dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh='输出一行结果字符串。' if pid==1202 else '先输出数量，再每行一个字符串，不能重复。' if pid==784 else '先输出2，再输出区间左右端点a b。',outputEn='Print the result string on one line.' if pid==1202 else 'Print the count, then one distinct string per line.' if pid==784 else 'Print 2, then interval endpoints a b.',difficulty='困难' if pid==632 else '中等',resultKind=kind,outputLimit=256,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:json.dumps(a,separators=(',',':'))+'\n',parse=parse,mutants=[dict(name=name,source='import sys,heapq\n'+inspect.getsource(fast)+'\n'+parse+f'\nresult=fast({pid},args,{i+1})\n'+emit+'\n') for i,name in enumerate(WRONG[pid])])
PROBLEMS={pid:make(pid) for pid in IDS}
