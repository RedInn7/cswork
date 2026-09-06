"""Acyclic, independently allocated linked-list fixtures. No downloaded code execution."""
import itertools
from collections import Counter
IDS=[203,206,21,876,83,19,82,328,86,24,92,61,234,143,2,445,147,148,23,25]
METHODS=dict(zip(IDS,['removeElements','reverseList','mergeTwoLists','middleNode','deleteDuplicates','removeNthFromEnd','deleteDuplicates','oddEvenList','partition','swapPairs','reverseBetween','rotateRight','isPalindrome','reorderList','addTwoNumbers','addTwoNumbers','insertionSortList','sortList','mergeKLists','reverseKGroup']))
TWO={21,2,445};TAIL={203:1,19:1,86:1,92:2,61:1,25:1}
BOUNDS={203:(0,10000,1,50),206:(0,5000,-5000,5000),21:(0,50,-100,100),876:(1,100,1,100),83:(0,300,-100,100),19:(1,30,0,100),82:(0,300,-100,100),328:(0,10000,-1000000,1000000),86:(0,200,-100,100),24:(0,100,0,100),92:(1,500,-500,500),61:(0,500,-100,100),234:(1,100000,0,9),143:(1,50000,1,1000),2:(1,100,0,9),445:(1,100,0,9),147:(1,5000,-5000,5000),148:(0,50000,-100000,100000),25:(1,5000,0,1000)}

def oracle(p,a):
 x=a[0]
 if p==203:return [v for v in x if v!=a[1]]
 if p==206:return x[::-1]
 if p==21:return sorted(x+a[1])
 if p==876:return x[len(x)//2:]
 if p==83:return sorted(set(x))
 if p==19:return [v for i,v in enumerate(x) if i!=len(x)-a[1]]
 if p==82:return [v for v in x if x.count(v)==1]
 if p==328:return x[::2]+x[1::2]
 if p==86:return [v for v in x if v<a[1]]+[v for v in x if v>=a[1]]
 if p==24:return [x[i+1] if i%2==0 and i+1<len(x) else x[i-1] if i%2 else x[i] for i in range(len(x))]
 if p==92:return x[:a[1]-1]+x[a[1]-1:a[2]][::-1]+x[a[2]:]
 if p==61:return [x[(i-a[1])%len(x)] for i in range(len(x))]
 if p==234:return int(all(x[i]==x[len(x)-1-i] for i in range(len(x)//2)))
 if p==143:return [x[(i//2 if i%2==0 else len(x)-1-i//2)] for i in range(len(x))]
 if p in {2,445}:
  nums=[int(''.join(map(str,t[::-1] if p==2 else t))) for t in a];digits=list(map(int,str(sum(nums))));return digits[::-1] if p==2 else digits
 if p in {147,148}:return sorted(x)
 if p==23:return sorted(itertools.chain.from_iterable(x))
 if p==25:return list(itertools.chain.from_iterable(x[i:i+a[1]][::-1] if i+a[1]<=len(x) else x[i:] for i in range(0,len(x),a[1])))
 raise AssertionError(p)

def validate(p,a):
 assert type(a)is list and len(a)==(2 if p in TWO else 1+TAIL.get(p,0))
 def seq(v,b):
  lo,hi,mn,mx=b;assert type(v)is list and lo<=len(v)<=hi and all(type(n)is int and mn<=n<=mx for n in v)
 if p==23:
  assert type(a[0])is list and len(a[0])<=10000 and sum(map(len,a[0]))<=10000
  for t in a[0]:seq(t,(0,500,-10000,10000));assert t==sorted(t)
  return
 for t in a[:2 if p in TWO else 1]:
  seq(t,BOUNDS[p])
  if p in {21,83,82}:assert t==sorted(t)
  if p in {2,445}:assert len(t)==1 or (t[-1] if p==2 else t[0])!=0
 x=a[0]
 if p in TAIL:assert all(type(v)is int for v in a[1:])
 if p==203:assert 0<=a[1]<=50
 if p==19:assert 1<=a[1]<=len(x)
 if p==86:assert -200<=a[1]<=200
 if p==92:assert 1<=a[1]<=a[2]<=len(x)
 if p==61:assert 0<=a[1]<=2000000000
 if p==25:assert 1<=a[1]<=len(x)

def encode(p,a):
 parts=[]
 if p==23:parts.append(str(len(a[0])));lists=a[0]
 else:lists=a[:2 if p in TWO else 1]
 for t in lists:parts.extend((str(len(t)),' '.join(map(str,t))))
 parts.extend(map(str,a[2 if p in TWO else 1:]));return '\n'.join(parts)+'\n'

def parse(p):
 z='tokens=iter(sys.stdin.read().split())\n'
 if p==23:return z+'k=int(next(tokens));args=[[[int(next(tokens)) for _ in range(int(next(tokens)))] for _ in range(k)]]'
 return z+'args=[[int(next(tokens)) for _ in range(int(next(tokens)))] for _ in range('+str(2 if p in TWO else 1)+')]\nargs.extend(map(int,tokens))'

def random_args(p,r):
 if p==23:return [[sorted(r.choices(range(-5,6),k=r.randrange(9))) for _ in range(r.randrange(9))]]
 def arr():
  lo,hi,mn,mx=BOUNDS[p];x=r.choices(range(max(mn,-9),min(mx,9)+1),k=r.randint(lo,min(hi,12)))
  if p in {21,83,82}:x.sort()
  if p in {2,445} and len(x)>1:x[-1 if p==2 else 0]=r.randint(1,9)
  return x
 x=arr();a=[x]
 if p in TWO:return [x,arr()]
 if p==203:a.append(r.randint(0,12))
 if p==19:a.append(r.randint(1,len(x)))
 if p==86:a.append(r.randint(-10,10))
 if p==92:a.extend(sorted(r.choices(range(1,len(x)+1),k=2)))
 if p==61:a.append(r.choice([0,1,2000000000,r.randrange(30)]))
 if p==25:a.append(r.randint(1,len(x)))
 if p==234 and r.randrange(2):
  half=x[:len(x)//2];a[0]=half+([x[len(x)//2]] if len(x)%2 else [])+half[::-1]
 return a

EDGE={203:[[[1,2,6,3,4,5,6],6],[[],0],[[7,7,7],7]],206:[[[1,2,3,4,5]],[[]],[[1]]],21:[[[1,2,4],[1,3,4]],[[],[]],[[],[0]]],876:[[[1,2,3,4,5]],[[1,2,3,4,5,6]],[[1]]],83:[[[1,1,2,3,3]],[[]],[[1,1]]],19:[[[1,2,3,4,5],2],[[1],1],[[1,2],2]],82:[[[1,2,3,3,4,4,5]],[[1,1,1,2,3]],[[1,1]],[[]]],328:[[[1,2,3,4,5]],[[2,1,3,5,6,4,7]],[[]]],86:[[[1,4,3,2,5,2],3],[[],0],[[3,1,2],2]],24:[[[1,2,3,4]],[[1,2,3]],[[]]],92:[[[1,2,3,4,5],2,4],[[1],1,1],[[1,2,3],1,3]],61:[[[1,2,3,4,5],2],[[0,1,2],4],[[],0]],234:[[[1,2,2,1]],[[1,2]],[[1]],[[1,2,1,2]]],143:[[[1,2,3,4]],[[1,2,3,4,5]],[[1]]],2:[[[2,4,3],[5,6,4]],[[0],[0]],[[9,9],[1]]],445:[[[7,2,4,3],[5,6,4]],[[0],[0]],[[9,9],[1]]],147:[[[4,2,1,3]],[[2,2,1]],[[1]]],148:[[[4,2,1,3]],[[]],[[2,2,1]]],23:[[[[1,4,5],[1,3,4],[2,6]]],[[]],[[[],[1]]]],25:[[[1,2,3,4,5],2],[[1,2,3,4,5],3],[[1],1]]}
PRESSURE={
203:[([[50]*10000,50],[]),([[1]*10000,0],[1]*10000)],206:[([list(range(-2500,2500))],list(range(2499,-2501,-1)))],21:[([[-100]*50,[100]*50],[-100]*50+[100]*50)],876:[([list(range(1,101))],list(range(51,101)))],83:[([[-100]*150+[100]*150],[-100,100])],19:[([list(range(30)),30],list(range(1,30)))],82:[([[-100]*150+[100]*150],[])],328:[([[-1000000,1000000]*5000],[-1000000]*5000+[1000000]*5000)],86:[([[100,-100]*100,0],[-100]*100+[100]*100)],24:[([list(range(100))],list(itertools.chain.from_iterable((i+1,i) for i in range(0,100,2))))],92:[([list(range(-250,250)),1,500],list(range(249,-251,-1)))],61:[([list(range(-100,100))*2+[0]*100,2000000000],list(range(-100,100))*2+[0]*100)],234:[([[9]*100000],1),([[0]*99999+[1]],0)],143:[([[1]*25000+[1000]*25000],[1,1000]*25000)],2:[([[9]*100,[1]], [0]*100+[1])],445:[([[9]*100,[1]], [1]+[0]*100)],147:[([list(range(2499,-2501,-1))],list(range(-2500,2500))),([[5000]+list(range(-4999,0))],list(range(-4999,0))+[5000])],148:[([list(range(24999,-25001,-1))],list(range(-25000,25000))),([[-100000,100000]*25000],[-100000]*25000+[100000]*25000)],23:[([[[1] for _ in range(10000)]],[1]*10000),([[[v]*500 for v in range(20)]],[v for v in range(20) for _ in range(500)])],25:[([[i%1001 for i in range(5000)],5000],[i%1001 for i in range(4999,-1,-1)])],
}
WRONG={
203:[('removes only first matching node',"result=x[:]\nif args[1] in result:result.remove(args[1])"),('also removes smaller values',"result=[v for v in x if v>args[1]]")],
206:[('drops first node before reversal',"result=x[1:][::-1]"),('sorts descending instead of reversing links',"result=sorted(x,reverse=True)")],
21:[('deduplicates merged values',"result=sorted(set(x+args[1]))"),('concatenates sorted inputs without merging',"result=x+args[1]")],
876:[('chooses first middle on even length',"result=x[(len(x)-1)//2:]"),('returns only middle node value',"result=[x[len(x)//2]]")],
83:[('removes all values having duplicates',"result=[v for v in x if x.count(v)==1]"),('keeps two copies of duplicate values',"result=[v for v in sorted(set(x)) for _ in range(min(2,x.count(v)))]")],
19:[('uses one based n from head instead of tail',"result=x[:args[1]-1]+x[args[1]:]"),('off by one in tail distance',"i=len(x)-args[1]-1;result=[v for j,v in enumerate(x) if j!=i]")],
82:[('keeps one copy of duplicates',"result=sorted(set(x))"),('only removes duplicated leading run',"result=x[:]\nwhile len(result)>1 and result[0]==result[1]:v=result[0];result=[n for n in result if n!=v]")],
328:[('partitions by value parity instead of position',"result=[v for v in x if v%2]+[v for v in x if v%2==0]"),('places even positions before odd positions',"result=x[1::2]+x[::2]")],
86:[('sorts instead of stable partition',"result=sorted(x)"),('moves values equal to pivot to first partition',"result=[v for v in x if v<=args[1]]+[v for v in x if v>args[1]]")],
24:[('reverses whole list',"result=x[::-1]"),('drops odd trailing node',"result=[v for i in range(0,len(x)-1,2) for v in (x[i+1],x[i])]")],
92:[('interprets endpoints as zero based',"l,r=args[1:];result=x[:l]+x[l:r+1][::-1]+x[r+1:]"),('reverses whole list',"result=x[::-1]")],
61:[('rotates left rather than right',"k=args[1]%len(x) if x else 0;result=x[k:]+x[:k]"),('does not reduce k modulo length',"k=args[1];result=x[-k:]+x[:-k] if k else x")],
234:[('only checks matching ends',"result=int(x[0]==x[-1])"),('checks whether a palindrome permutation exists',"result=int(sum(v%2 for v in Counter(x).values())<=1)")],
143:[('concatenates first half and reversed second half',"m=(len(x)+1)//2;result=x[:m]+x[m:][::-1]"),('interleaves starting with last node',"result=[x[-1-i//2] if i%2==0 else x[i//2] for i in range(len(x))]")],
2:[('reads low-first digits as high-first',"result=list(map(int,str(int(''.join(map(str,x)))+int(''.join(map(str,args[1]))))))"),('discards final carry',"out=[];carry=0\nfor i in range(max(len(x),len(args[1]))):\n n=(x[i] if i<len(x) else 0)+(args[1][i] if i<len(args[1]) else 0)+carry;out.append(n%10);carry=n//10\nresult=out")],
445:[('treats high-first digits as low-first',"n=int(''.join(map(str,x[::-1])))+int(''.join(map(str,args[1][::-1])));result=list(map(int,str(n)))[::-1]"),('discards extra leading carry digit',"s=str(int(''.join(map(str,x)))+int(''.join(map(str,args[1]))));result=list(map(int,s[-max(len(x),len(args[1])):]))")],
147:[('drops duplicates while sorting',"result=sorted(set(x))"),('sorts descending',"result=sorted(x,reverse=True)")],148:[('drops duplicates while sorting',"result=sorted(set(x))"),('only sorts the two halves separately',"m=len(x)//2;result=sorted(x[:m])+sorted(x[m:])")],
23:[('concatenates already sorted lists',"result=[v for t in x for v in t]"),('deduplicates merged result',"result=sorted({v for t in x for v in t})")],
25:[('reverses final incomplete group',"k=args[1];result=[v for i in range(0,len(x),k) for v in x[i:i+k][::-1]]"),('reverses whole list',"result=x[::-1]")],
}
EDGE[206].append([[3,1,2]])
EDGE[234].append([[1,2,3,1]])

META={
203:('移除链表元素','Remove Linked List Elements','删除所有值等于val的节点，保持其他节点的原次序。','Remove every node equal to val, preserving the order of other nodes.'),
206:('反转链表','Reverse Linked List','反转整个链表并返回新的头节点。','Reverse the entire list and return its new head.'),
21:('合并两个有序链表','Merge Two Sorted Lists','合并两个非递减链表，结果非递减，重复值出现次数必须保留。','Merge two nondecreasing lists into one nondecreasing list, preserving all repeated values.'),
876:('链表的中间结点','Middle of the Linked List','返回中间节点作为头的后缀链表；长度为偶数时取靠后的中间节点。','Return the suffix beginning at the middle node; for even length use the second middle node.'),
83:('删除排序链表中的重复元素','Remove Duplicates from Sorted List','输入非递减链表，每种值只保留一个节点。','Given a nondecreasing list, keep one node per distinct value.'),
19:('删除链表的倒数第N个结点','Remove Nth Node From End of List','删除从链表尾部数第n个节点，尾节点的n为1，返回剩余链表。','Remove the nth node counted from the tail, where n=1 removes the tail. Return the remaining list.'),
82:('删除排序链表中的重复元素 II','Remove Duplicates from Sorted List II','输入非递减链表；凡出现多次的值，删除它的所有节点，只保留出现一次的值。','In a nondecreasing list, remove every occurrence of any value appearing more than once. Keep only values occurring once.'),
328:('奇偶链表','Odd Even Linked List','把原链表奇数位置节点放在前面，再接偶数位置节点，各组内部保持顺序。位置从1开始，不是按值的奇偶性分类。','Place nodes at odd original positions before nodes at even original positions, preserving order within both groups. Positions start at 1; this is not value parity.'),
86:('分隔链表','Partition List','把值小于x的节点放在其他节点前，各部分都保持原相对顺序。','Move nodes with values less than x before all other nodes, preserving relative order within both partitions.'),
24:('两两交换链表中的节点','Swap Nodes in Pairs','从头开始每相邻两个节点交换位置；若末尾只剩一个节点，则保持不变。','Swap each adjacent pair of nodes from the head; leave a final unpaired node unchanged.'),
92:('反转链表 II','Reverse Linked List II','仅反转位置left到right的闭区间节点，位置从1开始，其余位置保持不变。','Reverse only the nodes in the inclusive positions left..right, using one-based positions; leave other positions unchanged.'),
61:('旋转链表','Rotate List','将链表向右循环移动k个位置，允许k超过长度，空链表仍为空。','Cyclically rotate the list right by k positions; k may exceed its length. An empty list stays empty.'),
234:('回文链表','Palindrome Linked List','判断从头到尾的节点值序列是否为回文。','Determine whether the node-value sequence reads the same forwards and backwards.'),
143:('重排链表','Reorder List','原节点为L0,L1,…,Ln，重排为L0,Ln,L1,Ln−1,…，每个节点恰好出现一次。输出修改后的链表。','Reorder L0,L1,…,Ln into L0,Ln,L1,Ln−1,…, using every node exactly once. Output the modified list.'),
2:('两数相加','Add Two Numbers','两条非空链表的节点是十进制数字，最低位在前。把两个数相加，结果也按最低位在前输出。','Two nonempty lists represent decimal integers with least significant digits first. Add them and return digits in the same least-significant-first order.'),
445:('两数相加 II','Add Two Numbers II','两条非空链表的节点是十进制数字，最高位在前。把两个数相加，结果也按最高位在前输出。','Two nonempty lists represent decimal integers with most significant digits first. Add them and return digits in the same most-significant-first order.'),
147:('对链表进行插入排序','Insertion Sort List','使用插入排序将链表按非递减顺序排列，保留每个节点值的出现次数。','Use insertion sort to arrange the list in nondecreasing order, preserving the multiplicity of every value.'),
148:('排序链表','Sort List','将链表按非递减顺序排列，保留全部重复值。','Sort the list in nondecreasing order, preserving all repeated values.'),
23:('合并K个升序链表','Merge k Sorted Lists','合并k条非递减链表，返回一个非递减链表，保留所有重复值；k可以为0，也允许某条链表为空。','Merge k nondecreasing lists into one nondecreasing list, preserving duplicates. k may be zero, and individual lists may be empty.'),
25:('K个一组翻转链表','Reverse Nodes in k-Group','按连续k个节点分组并反转每个完整组；最后不足k个的节点保持原顺序。','Reverse each complete consecutive group of k nodes; keep a final group shorter than k in its original order.'),
}
TAIL_META={203:('val，0≤val≤50','val, 0≤val≤50'),19:('n，1≤n≤链表长度','n, 1≤n≤list length'),86:('x，−200≤x≤200','x, −200≤x≤200'),92:('left right，1≤left≤right≤链表长度','left right, 1≤left≤right≤list length'),61:('k，0≤k≤2000000000','k, 0≤k≤2000000000'),25:('k，1≤k≤链表长度','k, 1≤k≤list length')}

def make(p):
 zh,en,dz,de=META[p]
 iz='每条链表用两行：第一行长度m，第二行m个空白分隔整数；空链表为0及一个空行。输入链表均无环，不共享节点。'
 ie='Each list uses two lines: length m, then m whitespace-separated integers. An empty list is 0 followed by a blank line. Lists are acyclic and share no nodes.'
 if p==23:
  iz='先输入链表数k，再依次输入各条链表。'+iz+'0≤k≤10000；每条长度0..500；总节点数≤10000；值在−10000..10000，各条非递减。'
  ie='First read list count k, then each list in order. '+ie+' 0≤k≤10000; each length 0..500; at most 10000 nodes total; values −10000..10000; each list is nondecreasing.'
 else:
  lo,hi,mn,mx=BOUNDS[p];iz+=f'每条实际长度{lo}..{hi}，值在{mn}..{mx}。';ie+=f' Each list length is {lo}..{hi}; values are {mn}..{mx}.'
  if p in TWO:iz+='依次给出第一条和第二条链表。';ie+=' Supply the first list, then the second list.'
  if p in {21,83,82}:iz+='保证输入链表非递减。';ie+=' Input lists are nondecreasing.'
  if p in {2,445}:
   iz+='除单节点0外，最高位不得为0，'+('即最后一个节点非零。' if p==2 else '即第一个节点非零。')
   ie+=' Except for the single-node number 0, the most significant digit is nonzero: '+('the final node.' if p==2 else 'the first node.')
 if p in TAIL:
  z,e=TAIL_META[p];iz+='链表段之后输入'+z+'。';ie+=' After the list, read '+e+'.'
 k='integer' if p==234 else 'integer-array'
 oz='是回文输出1，否则0。' if p==234 else '第一行输出结果链表长度，随后按从头到尾顺序输出所有节点值，用空白分隔；保留重复值。空结果仅输出0和换行。'
 oe='Print 1 for a palindrome, otherwise 0.' if p==234 else 'Print the result list length first, then all node values from head to tail separated by whitespace, preserving duplicates. An empty result is just 0 and a newline.'
 spec=dict(method=METHODS[p],titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='中等',resultKind=k,resultLinked='none' if p==234 else 'arg0' if p==143 else 'return',outputLimit={328:128,143:256,148:512}.get(p,64),edges=EDGE[p],pressure=PRESSURE[p],random_args=lambda r:random_args(p,r),oracle=lambda a:oracle(p,a),validate=lambda a:validate(p,a),encode=lambda a:encode(p,a),parse=parse(p),mutants=[])
 if p==23:spec['listArrayArgs']=[0]
 else:spec['listArgs']=[0,1] if p in TWO else [0]
 emit='print(result)' if p==234 else 'print(len(result));print(*result) if result else None'
 spec['mutants']=[dict(name=n,source='import sys\nfrom collections import Counter\n'+parse(p)+'\nx=args[0]\n'+body+'\n'+emit+'\n') for n,body in WRONG[p]]
 return spec

PROBLEMS={p:make(p) for p in IDS}
