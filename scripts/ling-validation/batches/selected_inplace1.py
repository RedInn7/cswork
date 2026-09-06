"""Selected foundation problems, including in-place and multiplicity-aware outputs.

Original small oracles use Python's basic sequence operations, exhaustive pairs,
and counting, independently of downloaded implementations. References run only
inside go-judge. Domains below were checked against the local bilingual snapshot.
"""
from collections import Counter
import itertools

IDS=[26,27,80,88,283,75,48,344,912,350,1,229,41]
METHODS=dict(zip(IDS,['removeDuplicates','removeElement','removeDuplicates','merge','moveZeroes','sortColors','rotate','reverseString','sortArray','intersect','twoSum','majorityElement','firstMissingPositive']))
ADAPTERS={26:'prefix-arg0',27:'prefix-arg0',80:'prefix-arg0',88:'arg0',283:'arg0',75:'arg0',48:'matrix-arg0',344:'characters-arg0'}
KINDS={27:'integer-multiset',344:'string',350:'integer-multiset',1:'integer-set',229:'integer-set',41:'integer'}
META={
26:('删除有序数组中的重复项','Remove Duplicates from Sorted Array','将非递减数组去重，输出有效前缀。长度 1..30000，值 -100..100。','Remove duplicates from a nondecreasing array and output its valid prefix. Length 1..30000; values -100..100.'),
27:('移除元素','Remove Element','删除所有等于 val 的元素。其余元素顺序任意，但出现次数必须保留。数组长度 0..100，元素 0..50，val 为 0..100。','Remove all occurrences of val. Preserve the multiplicity of other values; their order may vary. Length 0..100; elements 0..50; val 0..100.'),
80:('删除有序数组中的重复项 II','Remove Duplicates from Sorted Array II','将非递减数组中的每个值最多保留两次，输出有效前缀。长度 1..30000，值 -10000..10000。','Keep at most two occurrences of each value in a nondecreasing array. Length 1..30000; values -10000..10000.'),
88:('合并两个有序数组','Merge Sorted Array','合并两个非递减序列。输入仅提供第一数组的 m 个有效元素和第二数组的 n 个元素；第一数组尾部预留空间不输入。0<=m,n<=200，1<=m+n<=200，值在 [-10^9,10^9]。','Merge two nondecreasing sequences. Input supplies the m valid values of nums1 and the n values of nums2, omitting unused capacity. 0<=m,n<=200; 1<=m+n<=200; values in [-10^9,10^9].'),
283:('移动零','Move Zeroes','把所有零移到末尾，保持非零元素的相对顺序。长度 1..10000，值为有符号 32 位整数。','Move zeroes to the end while preserving the order of nonzero values. Length 1..10000; signed 32-bit integers.'),
75:('颜色分类','Sort Colors','将只含 0、1、2 的数组按升序排列。长度 1..300。','Sort an array containing only 0, 1, and 2 in ascending order. Length 1..300.'),
48:('旋转图像','Rotate Image','将 n×n 矩阵顺时针旋转 90 度。1<=n<=20，元素 -1000..1000。输出旋转后按行展开的全部元素。','Rotate an n-by-n matrix 90 degrees clockwise. 1<=n<=20; values -1000..1000. Output the rotated matrix in row-major order.'),
344:('反转字符串','Reverse String','反转字符数组。长度 1..100000，每个字符为可打印 ASCII 字符；空格也是字符。','Reverse the character array. Length 1..100000; characters are printable ASCII, including spaces.'),
912:('排序数组','Sort an Array','将数组按非递减顺序排列。长度 1..50000，值 -50000..50000。','Sort the array in nondecreasing order. Length 1..50000; values -50000..50000.'),
350:('两个数组的交集 II','Intersection of Two Arrays II','求两个数组的多重集合交集。每个值出现两数组中较少的次数，顺序任意。每个数组长度 1..1000，值 0..1000。','Return the multiset intersection. A value occurs the minimum of its two frequencies; output order may vary. Each length 1..1000; values 0..1000.'),
1:('两数之和','Two Sum','返回和为 target 的两个不同位置的下标，下标从 0 开始，顺序任意。保证恰好一组答案。长度 2..10000；元素和 target 均在 [-10^9,10^9]。','Return the zero-based indices of two distinct positions summing to target, in either order. Exactly one pair exists. Length 2..10000; values and target in [-10^9,10^9].'),
229:('多数元素 II','Majority Element II','返回出现次数严格大于 n/3 的所有值，顺序任意，不重复。长度 1..50000，值 -10^9..10^9。','Return all distinct values occurring strictly more than n/3 times, in any order. Length 1..50000; values -10^9..10^9.'),
41:('缺失的第一个正数','First Missing Positive','返回数组中没有出现的最小正整数。长度 1..100000，值为有符号 32 位整数。','Return the smallest positive integer absent from the array. Length 1..100000; signed 32-bit values.'),
}

def oracle(pid,a):
 x=a[0]
 if pid==26:return sorted(set(x))
 if pid==27:return [v for v in x if v!=a[1]]
 if pid==80:return list(itertools.chain.from_iterable([v]*min(2,n) for v,n in sorted(Counter(x).items())))
 if pid==88:return sorted(x[:a[1]]+a[2])
 if pid==283:return [v for v in x if v]+[0]*x.count(0)
 if pid in (75,912):return sorted(x)
 if pid==48:return [x[len(x)-1-r][c] for c in range(len(x)) for r in range(len(x))]
 if pid==344:return ''.join(x[::-1])
 if pid==350:return list((Counter(x)&Counter(a[1])).elements())
 if pid==1:return next([i,j] for i,j in itertools.combinations(range(len(x)),2) if x[i]+x[j]==a[1])
 if pid==229:return [v for v in set(x) if 3*x.count(v)>len(x)]
 if pid==41:return next(v for v in range(1,len(x)+2) if v not in x)
 raise AssertionError(pid)

def validate(pid,a):
 def integers(x,nlo,nhi,lo,hi):
  assert type(x)is list and nlo<=len(x)<=nhi and all(type(v)is int and lo<=v<=hi for v in x)
 x=a[0]
 if pid==48:
  assert 1<=len(x)<=20
  for row in x:integers(row,len(x),len(x),-1000,1000)
 elif pid==344:assert type(x)is list and 1<=len(x)<=100000 and all(type(c)is str and len(c)==1 and 32<=ord(c)<=126 for c in x)
 elif pid==88:
  _,m,y,n=a;assert type(m)is int and type(n)is int and 0<=m<=200 and 0<=n<=200 and 1<=m+n<=200
  integers(x,m+n,m+n,-10**9,10**9);integers(y,n,n,-10**9,10**9)
  assert x[:m]==sorted(x[:m]) and y==sorted(y) and x[m:]==[0]*n
 elif pid==350:
  for x in a:integers(x,1,1000,0,1000)
 else:
  bounds={26:(1,30000,-100,100),27:(0,100,0,50),80:(1,30000,-10000,10000),283:(1,10000,-2**31,2**31-1),75:(1,300,0,2),912:(1,50000,-50000,50000),1:(2,10000,-10**9,10**9),229:(1,50000,-10**9,10**9),41:(1,100000,-2**31,2**31-1)}
  integers(x,*bounds[pid])
  if pid in (26,80):assert x==sorted(x)
  if pid==27:assert type(a[1])is int and 0<=a[1]<=100
  if pid==1:
   assert type(a[1])is int and -10**9<=a[1]<=10**9
   seen=Counter();pairs=0
   for v in x:pairs+=seen[a[1]-v];seen[v]+=1
   assert pairs==1

def encode(pid,a):
 if pid==344:return ''.join(a[0])+'\n'
 if pid==48:return str(len(a[0]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a[0])
 if pid==88:return f'{a[1]} {a[3]}\n'+' '.join(map(str,a[0][:a[1]]))+'\n'+' '.join(map(str,a[2]))+'\n'
 if pid==350:return f'{len(a[0])} {len(a[1])}\n'+'\n'.join(' '.join(map(str,x)) for x in a)+'\n'
 return str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'+(str(a[1])+'\n' if pid in (27,1) else '')

def parse(pid):
 if pid==344:return "args=[list(sys.stdin.readline().removesuffix('\\n'))]"
 prefix='v=list(map(int,sys.stdin.read().split()))\n'
 if pid==48:return prefix+'n=v[0];args=[[v[1+i*n:1+(i+1)*n] for i in range(n)]]'
 if pid==88:return prefix+'m,n=v[:2];args=[v[2:2+m]+[0]*n,m,v[2+m:],n]'
 if pid==350:return prefix+'n,m=v[:2];args=[v[2:2+n],v[2+n:]]'
 if pid in (27,1):return prefix+'n=v[0];args=[v[1:n+1],v[n+1]]'
 return prefix+'args=[v[1:]]'

def random_args(pid,r):
 if pid==48:
  n=r.randint(1,5);return [[[r.randint(-10,10) for _ in range(n)] for _ in range(n)]]
 if pid==344:return [r.choices(' aAZ19!\\"~',k=r.randint(1,20))]
 if pid==88:
  m,n=r.randint(0,8),r.randint(0,8)
  if not m+n:m=1
  return [sorted(r.choices(range(-8,9),k=m))+[0]*n,m,sorted(r.choices(range(-8,9),k=n)),n]
 if pid==350:return [r.choices(range(7),k=r.randint(1,15)) for _ in range(2)]
 if pid==1:
  x=r.sample(range(30),r.randint(2,9));i,j=r.sample(range(len(x)),2);a=[x,x[i]+x[j]]
  if sum(x[u]+x[v]==a[1] for u,v in itertools.combinations(range(len(x)),2))!=1:return random_args(pid,r)
  return a
 x=r.choices(range(3) if pid==75 else range(8) if pid==27 else range(-8,9),k=r.randint(0 if pid==27 else 1,14))
 if pid in (26,80):x.sort()
 return [x,r.randint(0,9)] if pid==27 else [x]

EDGES={26:[[[1,1,2]],[[-100]],[[0,0,0]]],27:[[[3,2,2,3],3],[[],0],[[1,1,2],1]],80:[[[1,1,1,2,2,3]],[[0]],[[0]*5]],88:[[[1,2,3,0,0,0],3,[2,5,6],3],[[0],0,[1],1],[[1],1,[],0]],283:[[[0,1,0,3,12]],[[0]],[[1,2]]],75:[[[2,0,2,1,1,0]],[[0]],[[2,2]]],48:[[[[1,2],[3,4]]],[[[1]]]],344:[[list('hello')],[list(' a ')],[list('AB')]],912:[[[5,2,3,1]],[[-1,-1,0,2]],[[1]]],350:[[[1,2,2,1],[2,2]],[[1],[2]],[[0,0],[0]]],1:[[[2,7,11,15],9],[[3,3],6],[[-3,4,3,90],0]],229:[[[3,2,3]],[[1,2,3]],[[1,1,2,2]]],41:[[[1,2,0]],[[3,4,-1,1]],[[7,8,9,11,12]],[[1]]],}
PRESSURE={
26:[([[-100]*15000+[100]*15000],[-100,100])],
27:[([[2]*100,2],[]),([[1]*50+[2]*50,3],[1]*50+[2]*50)],
80:[([[-10000]*15000+[10000]*15000],[-10000,-10000,10000,10000])],
88:[([[-10**9]*100+[0]*100,100,[10**9]*100,100],[-10**9]*100+[10**9]*100)],
283:[([[0,-2**31,0,2**31-1]*2500],[-2**31,2**31-1]*2500+[0]*5000)],
75:[([[2]*100+[1]*100+[0]*100],[0]*100+[1]*100+[2]*100)],
48:[([[[r*20+c for c in range(20)] for r in range(20)]],[r*20+c for c in range(20) for r in range(19,-1,-1)])],
344:[([list(' '*50000+'a'*50000)],'a'*50000+' '*50000)],
912:[([list(range(24999,-25001,-1))],list(range(-25000,25000))),([[-50000,50000]*25000],[-50000]*25000+[50000]*25000)],
350:[([[1000]*1000,[1000]*999+[0]],[1000]*999)],
1:[([[10**9]*9998+[1,2],3],[9998,9999])],
229:[([[-10**9]*25000+[10**9]*25000],[-10**9,10**9]),([[0]*16666+[1]*16667+[2]*16667],[1,2])],
41:[([list(range(1,100001))],100001),([[-2**31,2**31-1]*50000],1)],
}
WRONG={26:'result=args[0]',27:'result=list(set(v for v in args[0] if v!=args[1]))',80:'result=sorted(set(args[0]))',88:'result=args[0][:args[1]]+args[2]',283:'result=sorted(args[0])',75:'result=sorted(args[0],reverse=True)',48:'result=[v for row in args[0] for v in row]',344:"result=''.join(args[0][::-1]).strip()",912:'result=list(dict.fromkeys(sorted(args[0])))',350:'result=list(set(args[0])&set(args[1]))',1:'result=[args[0][0],args[0][1]]',229:'result=[v for v in set(args[0]) if args[0].count(v)>=len(args[0])//3]',41:'result=max(args[0])+1'}

def make(pid):
 zh,en,desc,eng=META[pid];kind=KINDS.get(pid,'integer-array')
 iz,ie=('第一行 n，随后 n 个整数。','Read n, then n integers.')
 if pid in (27,1):iz+=' 最后输入 val。' if pid==27 else ' 最后输入 target。';ie+=' Finally read val.' if pid==27 else ' Finally read target.'
 if pid in (88,350):iz='第一行 m n，随后 m 个第一数组元素，再输入 n 个第二数组元素。';ie='Read m and n, then m values of the first sequence and n values of the second.'
 if pid==48:iz='第一行 n，随后 n 行各 n 个整数。';ie='Read n, followed by n rows of n integers.'
 if pid==344:iz='一整行字符，不含行尾换行；保留行首、行尾和内部空格。';ie='Read one complete line, excluding the terminating newline; preserve all spaces.'
 oz='输出一个整数。' if kind=='integer' else '输出反转后的完整字符串和换行，保留所有空格。' if kind=='string' else '第一行输出结果元素总数，随后输出所有整数。'+('按正确顺序输出。' if kind=='integer-array' else '顺序不限，每个值的出现次数必须正确。' if kind=='integer-multiset' else '顺序不限，不得重复。')
 oe='Print one integer.' if kind=='integer' else 'Print the reversed string and a newline, preserving all spaces.' if kind=='string' else 'Print the total result count on the first line, then its integers. '+('Preserve their required order.' if kind=='integer-array' else 'Order may vary, but each multiplicity must match.' if kind=='integer-multiset' else 'Order may vary; do not repeat values.')
 emit='print(result)' if kind in ('integer','string') else 'print(len(result));print(*result) if result else None'
 return dict(method=METHODS[pid],titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,resultKind=kind,resultAdapter=ADAPTERS.get(pid,'return'),outputLimit={344:128,912:512,283:256}.get(pid,64),edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[dict(name='常见错误处理',source='import sys\n'+parse(pid)+'\n'+WRONG[pid]+'\n'+emit+'\n')])

PROBLEMS={pid:make(pid) for pid in IDS}
