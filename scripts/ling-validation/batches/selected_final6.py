"""Six selected interview problems; authored data/oracles, never downloaded execution."""
import itertools,json,math,inspect
from fractions import Fraction
from collections import deque
IDS=(4,857,399,166,1095,759)

def decimal_string(value):
 if value==0:return '0'
 pieces=[]
 while value:
  value,part=divmod(value,10**500);pieces.append(str(part).zfill(500))
 return pieces[-1].lstrip('0')+''.join(reversed(pieces[:-1]))

def fraction_oracle(a):
 f=Fraction(*a);negative=f<0;n,d=abs(f.numerator),f.denominator
 integer,remainder=divmod(n,d)
 if not remainder:return ('-' if negative else '')+str(integer)
 rest=d;counts=[]
 for prime in (2,5):
  count=0
  while rest%prime==0:rest//=prime;count+=1
  counts.append(count)
 pre=max(counts);prefix,remainder=divmod(remainder*10**pre,d)
 answer=('-' if negative else '')+str(integer)+'.'+(str(prefix).zfill(pre) if pre else '')
 if remainder:
  period=1;power=10%rest
  while power!=1 and period<10000:power=power*10%rest;period+=1
  if period>=10000:raise ValueError('Answer violates original length guarantee')
  digits=decimal_string(remainder*(10**period-1)//d).zfill(period)
  answer+='('+digits+')'
 if len(answer)>=10000:raise ValueError('Answer violates original length guarantee')
 return answer

def oracle(pid,a):
 if pid==4:
  values=sorted(a[0]+a[1]);n=len(values);return (values[(n-1)//2]+values[n//2])/2
 if pid==857:
  quality,wage,k=a
  return float(min(sum(quality[i] for i in chosen)*max(Fraction(wage[i],quality[i]) for i in chosen) for chosen in itertools.combinations(range(len(quality)),k)))
 if pid==399:
  equations,values,queries=a;graph={}
  for (u,v),w in zip(equations,values):
   graph.setdefault(u,[]).append((v,Fraction(str(w))));graph.setdefault(v,[]).append((u,1/Fraction(str(w))))
  answers=[]
  for source,target in queries:
   if source not in graph or target not in graph:answers.append(-1.0);continue
   queue=[(source,Fraction(1),frozenset([source]))];answer=None
   while queue:
    node,value,seen=queue.pop()
    if node==target:answer=value;break
    for neighbor,weight in graph[node]:
     if neighbor not in seen:queue.append((neighbor,value*weight,seen|{neighbor}))
   answers.append(float(answer) if answer is not None else -1.0)
  return answers
 if pid==166:return fraction_oracle(a)
 if pid==1095:return next((i for i,v in enumerate(a[1]) if v==a[0]),-1)
 if pid==759:
  intervals=[pair for employee in a[0] for pair in employee];points=sorted({v for pair in intervals for v in pair});out=[]
  for left,right in zip(points,points[1:]):
   if not any(start<right and end>left for start,end in intervals):
    if out and out[-1][1]==left:out[-1][1]=right
    else:out.append([left,right])
  return out
 raise AssertionError(pid)

def validate(pid,a):
 def integer(v,lo,hi):assert type(v)is int and lo<=v<=hi
 def array(row,lo,hi,minimum,maximum):
  assert type(row)is list and minimum<=len(row)<=maximum
  for v in row:integer(v,lo,hi)
 assert type(a)is list
 if pid==4:
  assert len(a)==2
  for row in a:array(row,-10**6,10**6,0,1000);assert row==sorted(row)
  assert 1<=len(a[0])+len(a[1])<=2000
 elif pid==857:
  assert len(a)==3
  for row in a[:2]:array(row,1,10000,1,10000)
  assert len(a[0])==len(a[1]);integer(a[2],1,len(a[0]))
 elif pid==399:
  assert len(a)==3;equations,values,queries=a
  assert type(equations)is list and type(queries)is list and 1<=len(equations)<=20 and 1<=len(queries)<=20 and type(values)is list and len(values)==len(equations)
  for pair in equations+queries:
   assert type(pair)is list and len(pair)==2
   for word in pair:assert type(word)is str and 1<=len(word)<=5 and all(c in 'abcdefghijklmnopqrstuvwxyz0123456789' for c in word)
  assert all(type(v) in (int,float) and math.isfinite(v) and 0<v<=20 for v in values)
  # Check every declared ratio using independent reachability after withholding it.
  for i,((u,v),w) in enumerate(zip(equations,values)):
   remaining=[equations[:i]+equations[i+1:],values[:i]+values[i+1:],[[u,v]]]
   inferred=oracle(399,remaining)[0]
   if inferred!=-1:assert math.isclose(inferred,w,rel_tol=1e-9,abs_tol=1e-12)
   if u==v:assert w==1
 elif pid==166:
  assert len(a)==2
  for v in a:integer(v,-2**31,2**31-1)
  assert a[1]!=0;fraction_oracle(a)
 elif pid==1095:
  assert len(a)==2;integer(a[0],0,10**9);array(a[1],0,10**9,3,10000)
  row=a[1];peak=row.index(max(row));assert 0<peak<len(row)-1
  assert all(u<v for u,v in zip(row[:peak],row[1:peak+1])) and all(u>v for u,v in zip(row[peak:],row[peak+1:]))
 elif pid==759:
  assert len(a)==1 and type(a[0])is list and 1<=len(a[0])<=50
  for row in a[0]:
   assert type(row)is list and 1<=len(row)<=50
   for pair in row:array(pair,0,10**8,2,2);assert pair[0]<pair[1]
   assert all(left[1]<=right[0] for left,right in zip(row,row[1:]))
 else:raise AssertionError(pid)

def random_args(pid,r):
 if pid==4:
  n=r.randint(1,12);split=r.randrange(n+1);row=[r.randint(-20,20) for _ in range(n)];return [sorted(row[:split]),sorted(row[split:])]
 if pid==857:
  n=r.randint(1,8);return [[r.randint(1,20) for _ in range(n)],[r.randint(1,20) for _ in range(n)],r.randint(1,n)]
 if pid==399:
  n=r.randint(2,6);names=['x'+str(i) for i in range(n)];potential=[2**r.randint(0,4) for _ in names];pairs=r.sample(list(itertools.combinations(range(n),2)),r.randint(1,min(10,n*(n-1)//2)))
  return [[[names[i],names[j]] for i,j in pairs],[potential[i]/potential[j] for i,j in pairs],[[r.choice(names+['miss']),r.choice(names+['miss'])] for _ in range(r.randint(1,10))]]
 if pid==166:return [r.randint(-100,100),r.choice([v for v in range(-90,91) if v])]
 if pid==1095:
  left=r.sample(range(30),r.randint(1,7));right=r.sample(range(30),r.randint(1,7));row=sorted(left)+[30]+sorted(right,reverse=True);return [r.choice(row+[31]),row]
 if pid==759:
  schedule=[]
  for _ in range(r.randint(1,4)):
   points=sorted(r.sample(range(30),2*r.randint(1,4)));schedule.append([points[i:i+2] for i in range(0,len(points),2)])
  return [schedule]
 raise AssertionError(pid)

EDGES={4:[[[1,3],[2]],[[1,2],[3,4]],[[],[0]],[[-1],[]]],857:[[[10,20,5],[70,50,30],2],[[3,1,10,10,1],[4,8,2,2,7],3],[[1],[10000],1]],399:[[[['a','b'],['b','c']],[2.0,3.0],[['a','c'],['b','a'],['a','e'],['a','a'],['x','x']]],[[['a','b'],['c','d']],[1.0,2.0],[['a','d'],['x','x'],['c','d']]]],166:[[1,2],[2,3],[-50,8],[0,-1],[1,6],[1,90]],1095:[[3,[1,2,3,4,5,3,1]],[3,[0,1,2,4,2,1]],[1,[0,1,0]],[0,[0,1,0]]],759:[[[[1,2],[5,6]],[[1,3]],[[4,10]]]],}
# One positional argument containing the employee schedules.
EDGES[759]=[[EDGES[759][0]],[[[[1,2]],[[2,3]]]],[[[[0,100000000]]]]]
PRESSURE={4:[([[1000000]*1000,[-1000000]*1000],0.0),([[],list(range(1000))],499.5)],857:[([[10000]*10000,[10000]*10000,10000],100000000.0),([[10000]*10000,[1]*10000,1],1.0)],399:[([[[f'v{i:04d}',f'v{i+1:04d}'] for i in range(20)],[20.0]*20,[[f'v{i:04d}','v0020'] for i in range(20)]],[float(20**(20-i)) for i in range(20)]),([[[f'v{i:04d}',f'v{i+1:04d}'] for i in range(20)],[0.5]*20,[['v0020',f'v{i:04d}'] for i in range(20)]],[float(2**(20-i)) for i in range(20)])],166:[([-2**31,-1],'2147483648'),([1,-2**31],'-0.0000000004656612873077392578125'),([2**31-1,1],'2147483647')],1095:[([9998,[0,10**9]+list(range(9998,0,-1))],2),([0,list(range(9999))+[0]],0),([10**9,list(range(9999))+[0]],-1)],759:[([[[[2*(i*50+j),2*(i*50+j)+1] for j in range(50)] for i in range(50)]],[[2*i+1,2*i+2] for i in range(2499)]),([[[[10**8-100+2*j,10**8-99+2*j] for j in range(50)] for _ in range(50)]],[[10**8-99+2*j,10**8-98+2*j] for j in range(49)])]}
# Long legal recurring output, computed by multiplicative order, not downloaded code.
PRESSURE[166].append(([1,9967],fraction_oracle([1,9967])))

META={
4:('两个有序数组的中位数','Median of Two Sorted Arrays','findMedianSortedArrays','两个非递减整数数组合并后的中位数；总长度为偶数时取中间两数平均值。','Return the median of the combined nondecreasing integer arrays. For an even total size, average the two middle values.','JSON数组[nums1,nums2]。每个数组长度0至1000，总长度1至2000；元素在[-1000000,1000000]，均已非递减排序。','JSON [nums1,nums2]. Each length 0–1000, total length 1–2000; entries in [-1000000,1000000], each array nondecreasing.','float'),
857:('按质量比例雇用工人','Minimum Cost to Hire K Workers','mincostToHireWorkers','选择恰好k位工人，工资必须与质量成同一比例，且每人不低于其最低工资。返回最小总工资。','Choose exactly k workers, pay all chosen workers at one common wage-to-quality ratio, and meet each worker’s minimum wage. Minimize total pay.','JSON数组[quality,wage,k]。两个数组等长n，1≤k≤n≤10000；quality和wage元素均为1至10000。','JSON [quality,wage,k]. Equal array length n; 1≤k≤n≤10000; every quality and minimum wage is an integer 1–10000.','float'),
399:('查询变量之间的比值','Evaluate Division','calcEquation','每条equations[i]=[a,b]表示a/b=values[i]。按queries顺序返回比值；无法连通或变量未定义时返回-1，未定义变量除以自己也返回-1。已知等式互不矛盾。','Each equation [a,b] states a/b=values[i]. Return ratios in query order. Disconnected or undefined variables yield -1, including an undefined variable divided by itself. Equations are consistent.','JSON数组[equations,values,queries]。等式和查询各1至20条，每条两个变量；变量为1至5个小写字母或数字；values与等式等长，0<values[i]≤20，保证无矛盾、查询不会除以零。','JSON [equations,values,queries]. Each equation/query list has 1–20 pairs; names contain 1–5 lowercase English letters or digits. One value per equation, 0<value≤20; no contradictions or division by zero.','float-array'),
166:('分数的有限或循环小数','Fraction to Recurring Decimal','fractionToDecimal','将分数写成小数。循环部分放在括号中；可接受等值的不同循环节写法。能写成有限小数时必须使用有限表示，不接受带循环节的替代形式。','Represent the fraction as a decimal, enclosing a repeating part in parentheses. Equivalent placements or repetitions of a recurring period are accepted. A terminating fraction must use a finite decimal representation.','JSON数组[numerator,denominator]。两数均在[-2147483648,2147483647]，分母非零；保证存在长度小于10000的小数答案。','JSON [numerator,denominator]. Both are integers in [-2147483648,2147483647], denominator nonzero; an answer shorter than 10000 characters is guaranteed.','string'),
1095:('山脉数组中最早匹配的位置','Find in Mountain Array','findInMountainArray','数组先严格递增到内部峰值，再严格递减。返回目标值出现的最小下标，不存在返回-1。本平台提供标准输入数组；原题MountainArray接口的100次get限制仅用于参考适配验证，不声称限制学员标准输入程序的访问次数。','The array strictly increases to an interior peak, then strictly decreases. Return the smallest target index, or -1. This platform supplies the array through stdin; the original 100-call MountainArray API budget is checked only for the reference adapter, not enforced on student stdin programs.','JSON数组[target,mountainArr]。数组长度3至10000，目标和元素均为0至1000000000；峰值下标严格在两端之间。','JSON [target,mountainArr]. Length 3–10000; target and entries in [0,1000000000]; the peak is strictly inside the array.','integer'),
759:('所有员工共同的空闲区间','Employee Free Time','employeeFreeTime','每位员工的忙碌区间已排序且互不重叠。返回所有员工都空闲的有限、正长度区间，按起点递增；不包含两侧无界空闲时间。','Each employee’s busy intervals are sorted and nonoverlapping. Return finite, positive-length intervals when every employee is free, sorted by start; omit the unbounded outer free intervals.','JSON数组[schedule]；schedule有1至50位员工，每人1至50个[start,end]区间，0≤start<end≤100000000；每人的前一区间end≤后一区间start。','JSON [schedule]. There are 1–50 employees, each with 1–50 [start,end] intervals; 0≤start<end≤100000000. Within each employee’s sorted schedule, previous end≤next start.','integer-rows'),
}
WRONG={
4:[('even median uses upper middle','v=sorted(args[0]+args[1]);result=float(v[len(v)//2])'),('averages input medians without length weighting','v=[oracle(4,[row,[]]) for row in args if row];result=sum(v)/len(v)')],
857:[('ignores common proportional rate','result=float(sum(sorted(args[1])[:args[2]]))'),('pays equal wages instead of proportional wages','result=float(sorted(args[1])[args[2]-1]*args[2])')],
399:[('only direct equations are considered','e,v,q=args;table={(a,b):w for (a,b),w in zip(e,v)};result=[float(table.get((a,b),-1)) for a,b in q]'),('undefined self division is treated as one','result=oracle(399,args)\nfor i,(a,b) in enumerate(args[2]):\n if a==b:result[i]=1.0')],
166:[('drops the fraction sign','result=fraction_oracle([abs(args[0]),abs(args[1])])'),('rounds instead of representing repeating period','result=format(float(Fraction(*args)),".6f").rstrip("0").rstrip(".") or "0"')],
1095:[('returns last match instead of first','result=next((i for i in range(len(args[1])-1,-1,-1) if args[1][i]==args[0]),-1)'),('binary searches the whole nonmonotone array','target,row=args;lo,hi=0,len(row)\nwhile lo<hi:\n mid=(lo+hi)//2\n if row[mid]<target:lo=mid+1\n else:hi=mid\nresult=lo if lo<len(row) and row[lo]==target else -1')],
759:[('considers only the first employee','row=args[0][0];result=[[a[1],b[0]] for a,b in zip(row,row[1:]) if a[1]<b[0]]'),('emits zero length gaps between touching intervals','row=sorted(pair for employee in args[0] for pair in employee);result=[[a[1],b[0]] for a,b in zip(row,row[1:]) if a[1]<=b[0]]')],
}
# A target on the descending side defeats ordinary ascending-only binary search.
EDGES[1095].append([2,[0,4,3,2,1]])
EDGES[4].append([[0],[1,2,3]])

def make(pid):
 zh,en,method,dz,de,iz,ie,kind=META[pid]
 if kind in ('float','float-array'):
  oz='输出一个有限数值。' if kind=='float' else '第一行查询数，随后按查询顺序输出对应数量的有限数值。未知结果必须精确为-1。'
  oe='Print one finite number.' if kind=='float' else 'Print the query count, then that many finite numbers in query order. Unknown results must equal -1 exactly.'
  oz+='其他结果误差允许1e-5×max(1,|正确值|)。';oe+=' Other values allow error 1e-5×max(1,|expected|).'
 elif kind=='integer-rows':oz='第一行区间数；随后每行先写2，再写start end，严格按起点递增。';oe='Print the interval count; each following row starts with 2, then start end, strictly sorted by start.'
 elif kind=='string':oz='输出一行小数字符串，循环节用一对括号包住。';oe='Print one decimal string line, using parentheses around a recurring period.'
 else:oz='输出一个整数下标，未找到输出-1。';oe='Print one integer index, or -1 if absent.'
 helpers='import sys,json,itertools,math\nfrom fractions import Fraction\nfrom collections import deque\n'+''.join(inspect.getsource(f)+'\n' for f in (decimal_string,fraction_oracle,oracle))
 parse='import json\nargs=json.loads(sys.stdin.read())'
 emit='print(result)' if kind in ('integer','float','string') else 'print(len(result));print(*result)' if kind=='float-array' else 'print(len(result))\nfor row in result:print(len(row),*row)'
 data=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in (4,857,1095,759) else '中等',resultKind=kind,edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:json.dumps(a,separators=(',',':'))+'\n',parse=parse,mutants=[dict(name=name,source=helpers+parse+'\n'+body+'\n'+emit+'\n') for name,body in WRONG[pid]])
 if pid in (1095,759):data['auxiliaryId']=pid
 if pid==166:data['checker']='fraction-lc-166'
 return data
PROBLEMS={pid:make(pid) for pid in IDS}
