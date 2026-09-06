"""Authored state-machine models; downloaded implementations are never imported."""
import json
import inspect
import random

IDS=[225,232,155,622,641,707,146,460,703,1146,2080,362,676,745,1166]
CLASSES=dict(zip(IDS,['MyStack','MyQueue','MinStack','MyCircularQueue','MyCircularDeque','MyLinkedList','LRUCache','LFUCache','KthLargest','SnapshotArray','RangeFreqQuery','HitCounter','MagicDictionary','WordFilter','FileSystem']))
METHODS={225:['push','pop','top','empty'],232:['push','pop','peek','empty'],155:['push','pop','top','getMin'],622:['enQueue','deQueue','Front','Rear','isEmpty','isFull'],641:['insertFront','insertLast','deleteFront','deleteLast','getFront','getRear','isEmpty','isFull'],707:['get','addAtHead','addAtTail','addAtIndex','deleteAtIndex'],146:['get','put'],460:['get','put'],703:['add'],1146:['set','snap','get'],2080:['query'],362:['hit','getHits'],676:['buildDict','search'],745:['f'],1166:['createPath','get']}
LIMIT=dict(zip(IDS,[100,100,30000,3000,2000,2000,200000,200000,10000,50000,100000,300,101,10000,10000]))

def model(pid,args,wrong=0):
 ops,params=args;ctor=params[0];out=[None];seq=[];cache={};frequency={};stamp={};snapshots=[];history=[];paths={};words=[]
 if pid==703:seq=ctor[1][:]
 if pid==745:words=ctor[0]
 for tick,(op,a) in enumerate(zip(ops[1:],params[1:])):
  value=None
  if pid in (225,232,155):
   if op=='push':seq.append(a[0])
   elif op=='pop':
    v=seq.pop(0 if pid==232 else -1);value=None if pid==155 else v
   elif op in ('top','peek'):value=seq[0 if pid==232 else -1]
   elif op=='getMin':value=min(seq)
   else:value=int(not seq)
  elif pid in (622,641):
   k=ctor[0]
   if op in ('enQueue','insertFront','insertLast'):
    value=int(len(seq)<k)
    if value:seq.insert(0,a[0]) if op=='insertFront' else seq.append(a[0])
   elif op in ('deQueue','deleteFront','deleteLast'):
    value=int(bool(seq))
    if value:seq.pop(-1 if op=='deleteLast' else 0)
   elif op in ('Front','getFront'):value=seq[0] if seq else -1
   elif op in ('Rear','getRear'):value=seq[-1] if seq else -1
   elif op=='isEmpty':value=int(not seq)
   else:value=int(len(seq)==k)
  elif pid==707:
   if op=='get':value=seq[a[0]] if a[0]<len(seq) else -1
   elif op=='addAtHead':seq.insert(0,a[0])
   elif op=='addAtTail':seq.append(a[0])
   elif op=='addAtIndex':
    if a[0]<=len(seq):seq.insert(a[0],a[1])
   elif a[0]<len(seq):seq.pop(a[0])
  elif pid in (146,460):
   key=a[0]
   if op=='get':value=cache.get(key,-1)
   if op=='put' or key in cache:
    if key not in cache:
     if len(cache)==ctor[0]:
      victim=min(cache,key=lambda x:(frequency[x] if pid==460 else 0,stamp[x]));del cache[victim];del frequency[victim];del stamp[victim]
     frequency[key]=0
    frequency[key]+=1;stamp[key]=tick
    if op=='put':cache[key]=a[1]
  elif pid==703:
   seq.append(a[0]);value=sorted(seq,reverse=True)[ctor[0]-1]
  elif pid==1146:
   if op=='set':cache[a[0]]=a[1]
   elif op=='snap':value=len(snapshots);snapshots.append(cache.copy())
   else:value=snapshots[a[1]].get(a[0],0)
  elif pid==2080:value=sum(x==a[2] for x in ctor[0][a[0]:a[1]+1])
  elif pid==362:
   if op=='hit':history.append(a[0])
   else:value=sum(a[0]-300<t<=a[0] for t in history)
  elif pid==676:
   if op=='buildDict':words=a[0]
   else:value=int(any(len(w)==len(a[0]) and sum(x!=y for x,y in zip(w,a[0]))==1 for w in words))
  elif pid==745:value=max((i for i,w in enumerate(words) if w.startswith(a[0]) and w.endswith(a[1])),default=-1)
  elif pid==1166:
   path=a[0]
   if op=='get':value=paths.get(path,-1)
   else:
    value=int(path not in paths and (path.rsplit('/',1)[0]=='' or path.rsplit('/',1)[0] in paths))
    if value:paths[path]=a[1]
  # Common observable protocol errors: drop constructor slot or conflate void with zero.
  out.append(value)
 if wrong==1:return out[1:]
 if wrong==2:return [0 if x is None else x for x in out]
 return out

def encode(args):return '\n'.join(json.dumps(x,separators=(',',':')) for x in args)+'\n'
PARSE="args=[json.loads(line) for line in sys.stdin.read().splitlines()]"

def validate(pid,args):
 assert type(args)is list and len(args)==2
 ops,rows=args;assert type(ops)is list and type(rows)is list and len(ops)==len(rows) and 1<=len(ops)<=LIMIT[pid]+1 and ops[0]==CLASSES[pid]
 assert all(type(row)is list for row in rows)
 c=rows[0]
 def integer(v,lo,hi):assert type(v)is int and lo<=v<=hi
 def word(w,lo=1,hi=100):assert type(w)is str and lo<=len(w)<=hi and all('a'<=x<='z' for x in w)
 if pid in (622,641,146,460,1146):assert len(c)==1;integer(c[0],1,{622:1000,641:1000,146:3000,460:10000,1146:50000}[pid])
 elif pid==703:
  assert len(c)==2 and type(c[1])is list and len(c[1])<=10000;integer(c[0],1,len(c[1])+1)
  for v in c[1]:integer(v,-10000,10000)
 elif pid==2080:
  assert len(c)==1 and type(c[0])is list and 1<=len(c[0])<=100000
  for v in c[0]:integer(v,1,10000)
 elif pid==745:
  assert len(c)==1 and type(c[0])is list and 1<=len(c[0])<=10000
  for w in c[0]:word(w,1,7)
 else:assert c==[]
 size=0;snaps=0;last=1;built=False;searches=0
 for op,a in zip(ops[1:],rows[1:]):
  assert op in METHODS[pid]
  arities={'push':1,'pop':0,'top':0,'peek':0,'empty':0,'getMin':0,'enQueue':1,'deQueue':0,'Front':0,'Rear':0,'isEmpty':0,'isFull':0,'insertFront':1,'insertLast':1,'deleteFront':0,'deleteLast':0,'getFront':0,'getRear':0,'addAtHead':1,'addAtTail':1,'addAtIndex':2,'deleteAtIndex':1,'put':2,'add':1,'set':2,'snap':0,'query':3,'hit':1,'getHits':1,'buildDict':1,'search':1,'f':2,'createPath':2,'get':2 if pid==1146 else 1}
  assert len(a)==arities[op]
  if pid in (225,232,155):
   if op=='push':integer(a[0],-2**31 if pid==155 else 1,2**31-1 if pid==155 else 9);size+=1
   elif op!='empty':assert size>0;size-=int(op=='pop')
  elif pid in (622,641,707):
   for v in a:integer(v,0,1000)
  elif pid in (146,460):
   integer(a[0],0,10000 if pid==146 else 100000)
   if op=='put':integer(a[1],0,100000 if pid==146 else 10**9)
  elif pid==703:integer(a[0],-10000,10000)
  elif pid==1146:
   if op=='snap':snaps+=1
   else:
    integer(a[0],0,c[0]-1);integer(a[1],0,10**9 if op=='set' else snaps-1)
  elif pid==2080:integer(a[0],0,len(c[0])-1);integer(a[1],a[0],len(c[0])-1);integer(a[2],1,10000)
  elif pid==362:integer(a[0],last,2*10**9);last=a[0]
  elif pid==676:
   if op=='buildDict':
    assert not built and type(a[0])is list and 1<=len(a[0])<=100 and len(set(a[0]))==len(a[0]);built=True
    for w in a[0]:word(w)
   else:assert built;word(a[0]);searches+=1;assert searches<=100
  elif pid==745:
   for w in a:word(w,1,7)
  else:
   path=a[0];assert type(path)is str and 2<=len(path)<=100 and path.startswith('/')
   for part in path[1:].split('/'):word(part)
   if op=='createPath':integer(a[1],1,10**9)
 if pid==676:assert built

def random_args(pid,r):
 c={622:[r.randint(1,5)],641:[r.randint(1,5)],146:[r.randint(1,4)],460:[r.randint(1,4)],1146:[r.randint(1,6)],2080:[[r.randint(1,5) for _ in range(r.randint(1,12))]],745:[[r.choice(['a','ab','ba','aaa','aba']) for _ in range(r.randint(1,8))]]}.get(pid,[])
 if pid==703:
  nums=[r.randint(-5,5) for _ in range(r.randint(0,8))];c=[r.randint(1,len(nums)+1),nums]
 ops=[CLASSES[pid]];rows=[c];size=0;snaps=0;t=1
 if pid==676:ops.append('buildDict');rows.append([r.sample(['a','b','aa','ab','ba','abc','aba'],r.randint(1,7))])
 for _ in range(r.randint(8,35)):
  op=r.choice(METHODS[pid]);a=[]
  if pid in (225,232,155):
   if not size:op='push'
   if op=='push':a=[r.randint(-5,5) if pid==155 else r.randint(1,9)];size+=1
   elif op=='pop':size-=1
  elif pid in (622,641):
   if op in ('enQueue','insertFront','insertLast'):a=[r.choice([0,1,2,1000])]
  elif pid==707:a=[r.randint(0,8)]*(2 if op=='addAtIndex' else 1)
  elif pid in (146,460):a=[r.randint(0,5)]+([r.randint(0,9)] if op=='put' else [])
  elif pid==703:a=[r.randint(-5,5)]
  elif pid==1146:
   if op=='get' and not snaps:op='snap'
   if op=='snap':snaps+=1
   else:a=[r.randrange(c[0]),r.randint(0,9) if op=='set' else r.randrange(snaps)]
  elif pid==2080:
   left=r.randrange(len(c[0]));a=[left,r.randrange(left,len(c[0])),r.randint(1,6)]
  elif pid==362:t+=r.choice([0,1,299,300,301]);a=[t]
  elif pid==676:op='search';a=[r.choice(['a','b','c','aa','ab','bb','abc','aaa','zzzz'])]
  elif pid==745:a=[r.choice(['a','b','ab','ba','aaa']),r.choice(['a','b','ab','ba','aaa'])]
  else:a=[r.choice(['/a','/b','/a/b','/a/b/c','/b/a','/z/y'])]+([r.randint(1,9)] if op=='createPath' else [])
  ops.append(op);rows.append(a)
 return [ops,rows]

def pressure(pid):
 """Maximum-length traces have closed-form outputs, no expensive model replay."""
 n=LIMIT[pid];c=[];op='';a=[];v=None
 if pid in (146,460):
  cap=3000 if pid==146 else 10000
  ops=[CLASSES[pid]]+['put']*cap+['get','put','get','get']
  rows=[[cap]]+[[i,7] for i in range(cap)]+[[0],[cap,9],[1],[0]]
  results=[None]+[None]*cap+[7,None,-1,7]
  extra=n+1-len(ops);return [([ops+['get']*extra,rows+[[0]]*extra],results+[7]*extra)]
 if pid in (622,641):
  insert='enQueue' if pid==622 else 'insertLast';remove='deQueue' if pid==622 else 'deleteFront'
  calls=[(insert,[i]) for i in range(1000)]
  calls.extend((remove,[]) if i%2==0 else (insert,[1000]) for i in range(n-1000))
  return [([[CLASSES[pid]]+[op for op,a in calls],[[1000]]+[a for op,a in calls]],[None]+[1]*n)]
 if pid==707:
  return [([[CLASSES[pid]]+['addAtTail']*1000+['get']*1000,[[]]+[[i] for i in range(1000)]+[[i] for i in range(1000)]],[None]+[None]*1000+list(range(1000)))]
 if pid==1146:
  return [([[CLASSES[pid]]+['set','snap']*25000,[[50000]]+[[49999,10**9],[]]*25000],[None]+[v for i in range(25000) for v in (None,i)])]
 if pid==362:
  return [([[CLASSES[pid]]+['hit']*299+['getHits'],[[]]+[[2*10**9]]*300],[None]+[None]*299+[299])]
 if pid in (225,232,155):op='push';a=[9 if pid!=155 else -2**31]
 elif pid in (622,641):c=[1000];op='isEmpty';v=1
 elif pid==707:op='get';a=[1000];v=-1
 elif pid in (146,460):c=[3000 if pid==146 else 10000];op='get';a=[0];v=-1
 elif pid==703:c=[10001,[-10000]*10000];op='add';a=[10000];v=None
 elif pid==1146:c=[50000];op='snap'
 elif pid==2080:c=[[10000]*100000];op='query';a=[0,99999,10000];v=100000
 elif pid==362:op='hit';a=[2*10**9]
 elif pid==676:
  words=['a'*98+chr(97+i//26)+chr(97+i%26) for i in range(100)]
  return [([[CLASSES[pid],'buildDict']+['search']*100,[[],[words]]+[['a'*99+'z']]*100],[None,None]+[1]*100)]
 elif pid==745:c=[['a'*7]*10000];op='f';a=['a'*7,'a'*7];v=9999
 elif pid==1166:op='get';a=['/'+'a'*99];v=-1
 values=[None]+[v]*n
 if pid==1146:values=[None]+list(range(n))
 if pid==703:values=[None]+[-10000]*10000
 return [([[CLASSES[pid]]+[op]*n,[c]+[a]*n],values)]

TEXT={
225:('用队列实现栈','Implement Stack using Queues','实现后进先出栈。push 入栈，pop 删除并返回栈顶，top 返回栈顶，empty 判断空。只能使用队列基本操作。x 在 1..9；最多 100 次方法调用；pop/top 时非空。','Implement a LIFO stack using basic queue operations. push inserts; pop removes and returns the top; top reads it; empty tests emptiness. Values 1..9; at most 100 calls; pop/top always have an element.'),
232:('用栈实现队列','Implement Queue using Stacks','实现先进先出队列。push 入队，pop 删除并返回队首，peek 返回队首，empty 判断空。只能使用栈基本操作。x 在 1..9；最多 100 次调用；pop/peek 时非空。','Implement a FIFO queue using basic stack operations. push inserts; pop removes and returns the front; peek reads it; empty tests emptiness. Values 1..9; at most 100 calls; pop/peek are valid.'),
155:('最小栈','Min Stack','push(val) 入栈，pop() 删除栈顶无返回值，top() 返回栈顶，getMin() 返回当前最小值；每个操作 O(1)。val 为有符号 32 位整数，最多 30000 次调用；读取和删除时非空。','push(val) appends, pop() removes without returning a value, top() reads the top, getMin() reads the current minimum. Every operation is O(1). Signed 32-bit values; at most 30000 calls; reads and removals are nonempty.'),
622:('设计循环队列','Design Circular Queue','构造容量 k 的循环队列；enQueue(value)/deQueue() 成功返回真，满/空时返回假且不改变状态。Front()/Rear() 读取两端，空时 -1；isEmpty()/isFull() 判断状态。1<=k<=1000，0<=value<=1000，最多 3000 次调用，不用内置队列。','Construct a circular queue of capacity k. enQueue(value)/deQueue() return success; full/empty failures leave state unchanged. Front()/Rear() return endpoints or -1 when empty. isEmpty()/isFull() test state. k 1..1000, values 0..1000, at most 3000 calls; do not use a built-in queue.'),
641:('设计循环双端队列','Design Circular Deque','容量 k；insertFront/insertLast(value) 插入，deleteFront/deleteLast() 删除；成功真、失败假且不改变状态。getFront/getRear() 空时 -1；isEmpty/isFull() 判断状态。k 在 1..1000，值 0..1000，最多 2000 次调用。','Capacity k; insertFront/insertLast(value) insert, deleteFront/deleteLast() remove, returning success and leaving state unchanged on failure. getFront/getRear() return -1 when empty; isEmpty/isFull() test state. k 1..1000; values 0..1000; at most 2000 calls.'),
707:('设计链表','Design Linked List','实现单/双链表，不用内置链表。get(index) 读取零起始位置，越界 -1；addAtHead/AtTail(val) 插入；addAtIndex(index,val) 在该位置之前插入，index 等于长度时追加、大于长度时忽略；deleteAtIndex(index) 删除有效位置。index 和 val 在 0..1000，最多 2000 次调用。','Implement a singly/doubly linked list without a built-in linked-list library. get(index) reads a zero-based position or -1 if invalid. addAtHead/AtTail(val) insert. addAtIndex(index,val) inserts before index, appends at length, ignores larger indexes. deleteAtIndex(index) removes only valid positions. Index and value 0..1000; at most 2000 calls.'),
146:('LRU 缓存','LRU Cache','capacity 在 1..3000。get(key) 返回值或 -1，并在命中时更新最近使用顺序；put(key,value) 插入或更新，也更新使用顺序。超容量淘汰最久未使用项。平均 O(1)。key 在 0..10000，value 在 0..100000，最多 200000 次调用。','Capacity 1..3000. get(key) returns its value or -1 and refreshes recency on a hit. put(key,value) inserts/updates and refreshes recency. Evict the least recently used entry when full. Average O(1) operations. Keys 0..10000, values 0..100000, at most 200000 calls.'),
460:('LFU 缓存','LFU Cache','capacity 在 1..10000。get(key) 返回值或 -1；put(key,value) 插入/更新。新项频率 1，命中 get 或更新 put 频率加一；淘汰最低频率，同频淘汰最久未使用。平均 O(1)。key 在 0..100000，value 在 0..10^9，最多 200000 次调用。','Capacity 1..10000. get(key) returns a value or -1; put(key,value) inserts/updates. New entries start at frequency 1; successful gets and updates increment frequency. Evict lowest frequency, breaking ties by least recent use. Average O(1). Keys 0..100000, values 0..10^9, at most 200000 calls.'),
703:('数据流中的第 K 大元素','Kth Largest Element in a Stream','构造参数 k,nums；add(val) 加入并返回含重复项排序后的第 k 大。nums 长度 0..10000，1<=k<=len(nums)+1，nums 和 val 在 -10000..10000，最多 10000 次 add。','Constructor takes k,nums. add(val) inserts and returns the kth largest including duplicates. Initial length 0..10000, k 1..len(nums)+1; initial/added values -10000..10000; at most 10000 add calls.'),
1146:('快照数组','Snapshot Array','length 在 1..50000，初始全零。set(index,val) 修改当前数组；snap() 保存快照，返回从 0 递增的编号；get(index,snap_id) 读该历史快照。index 有效，val 在 0..10^9，snap_id 必须已生成；最多 50000 次调用。','Length 1..50000, initially zero. set(index,val) changes current state; snap() saves it and returns successive IDs starting at 0; get(index,snap_id) reads that saved snapshot. Index is valid; values 0..10^9; snapshot IDs already exist; at most 50000 calls.'),
2080:('区间内查询数字的频率','Range Frequency Queries','构造只读 arr，长度 1..100000，元素 1..10000。query(left,right,value) 返回闭区间中 value 次数。0<=left<=right<len(arr)，value 在 1..10000，最多 100000 次调用。','Construct with immutable arr of length 1..100000, values 1..10000. query(left,right,value) counts value in the inclusive interval. 0<=left<=right<len(arr), value 1..10000; at most 100000 calls.'),
362:('敲击计数器','Design Hit Counter','hit(timestamp) 记录一次命中；getHits(timestamp) 返回当前时间最近 300 秒的命中数，即 timestamp-299 到 timestamp（含端点），同秒可多次。所有调用 timestamp 非递减，在 1..2*10^9；最多 300 次调用。','hit(timestamp) records one hit. getHits(timestamp) counts timestamps from timestamp-299 through timestamp inclusive; multiple hits in a second count separately. All call timestamps are nondecreasing within 1..2*10^9; at most 300 calls.'),
676:('实现一个魔法字典','Implement Magic Dictionary','buildDict(dictionary) 只调用一次且先于 search；字典含 1..100 个互异小写词，每词长 1..100。search(searchWord) 判断能否恰好替换一个字符得到字典词，不能插入或删除；查询词长 1..100，最多 100 次 search。','buildDict(dictionary) is called exactly once before searches. Dictionary has 1..100 distinct lowercase words, lengths 1..100. search(searchWord) tests whether changing exactly one character yields a dictionary word, without insertion/deletion. Query length 1..100; at most 100 searches.'),
745:('前缀和后缀搜索','Prefix and Suffix Search','构造 words 含 1..10000 个小写词，词长 1..7，允许重复。f(pref,suff) 返回同时匹配前缀和后缀的最大原始下标，无匹配 -1；前后缀可重叠，均为长 1..7 的小写串。最多 10000 次调用。','words contains 1..10000 lowercase words of length 1..7, duplicates allowed. f(pref,suff) returns the largest original index matching both, or -1. Prefix/suffix may overlap and are nonempty lowercase strings of length 1..7. At most 10000 calls.'),
1166:('设计文件系统','Design File System','createPath(path,value) 仅在路径不存在且父路径存在时创建返回真，否则假，不覆盖。根目录隐含存在。get(path) 返回值或 -1。路径长 2..100，以 / 开头，非空小写段以 / 分隔，无尾 /；不允许根路径。value 在 1..10^9，最多 10000 次调用。','createPath(path,value) succeeds only if absent and its parent exists; failure never overwrites. Root exists implicitly. get(path) returns a value or -1. Paths length 2..100 start with / and contain nonempty lowercase segments separated by /, with no trailing /; root is not a valid argument. Values 1..10^9; at most 10000 calls.')}

# Directed traces supplement randomized cases with observable boundary semantics.
CASES={
225:[([], [('push',[1]),('push',[9]),('top',[]),('pop',[]),('top',[]),('empty',[]),('pop',[]),('empty',[])])],
232:[([], [('push',[1]),('push',[9]),('peek',[]),('pop',[]),('peek',[]),('empty',[]),('pop',[]),('empty',[])])],
155:[([], [('push',[-2**31]),('push',[2**31-1]),('getMin',[]),('pop',[]),('top',[]),('getMin',[])])],
622:[([1],[('Front',[]),('enQueue',[1000]),('enQueue',[0]),('Rear',[]),('isFull',[]),('deQueue',[]),('enQueue',[0]),('Front',[])])],
641:[([2],[('insertFront',[1000]),('insertLast',[0]),('getFront',[]),('getRear',[]),('insertFront',[1]),('deleteLast',[]),('getFront',[])])],
707:[([],[('addAtIndex',[1,9]),('get',[0]),('addAtHead',[1]),('addAtIndex',[1,2]),('get',[1]),('addAtIndex',[0,3]),('get',[0]),('deleteAtIndex',[3]),('get',[2])])],
146:[([2],[('put',[1,1]),('put',[2,2]),('get',[1]),('put',[3,3]),('get',[2]),('put',[1,9]),('get',[1]),('put',[4,4]),('get',[3])])],
460:[([2],[('put',[1,1]),('put',[2,2]),('get',[1]),('get',[1]),('get',[2]),('put',[3,3]),('get',[1]),('get',[2])]),([2],[('put',[1,1]),('put',[2,2]),('put',[1,9]),('put',[3,3]),('get',[1]),('get',[2])])],
703:[([2,[2]],[('add',[2]),('add',[9]),('add',[-10000])])],
1146:[([2],[('set',[0,5]),('snap',[]),('set',[0,6]),('get',[0,0]),('get',[1,0]),('snap',[]),('get',[0,1])])],
2080:[([[1,2,1]],[('query',[0,2,1]),('query',[0,0,1]),('query',[1,1,1])])],
362:[([],[('hit',[1]),('hit',[1]),('getHits',[300]),('getHits',[301])])],
676:[([],[('buildDict',[['hello']]),('search',['hello']),('search',['hallo']),('search',['hell'])])],
745:[([['aaa','aaa','aba']],[('f',['a','a']),('f',['aaa','aaa']),('f',['b','a'])])],
1166:[([],[('createPath',['/a/b',9]),('createPath',['/a',1]),('createPath',['/a',2]),('get',['/a']),('createPath',['/a/b',3]),('get',['/a/b'])])],
}
# Each mutation changes one semantic rule, retaining the output protocol.
MUTATIONS={
225:[('uses FIFO removal',"seq.pop(0 if pid==232 else -1)","seq.pop(0)"),('reads oldest value as top',"seq[0 if pid==232 else -1]","seq[0]")],
232:[('uses LIFO removal',"seq.pop(0 if pid==232 else -1)","seq.pop(-1)"),('reads newest value as front',"seq[0 if pid==232 else -1]","seq[-1]")],
155:[('returns maximum as minimum','value=min(seq)','value=max(seq)'),('reads oldest as top','seq[0 if pid==232 else -1]','seq[0]')],
622:[('accepts one beyond capacity','len(seq)<k','len(seq)<=k'),('rear reads front','seq[-1] if seq else -1','seq[0] if seq else -1')],
641:[('inserts front at back',"seq.insert(0,a[0]) if op=='insertFront' else seq.append(a[0])","seq.append(a[0])"),('removes front instead of last',"seq.pop(-1 if op=='deleteLast' else 0)",'seq.pop(0)')],
707:[('cannot insert at current length','a[0]<=len(seq)','a[0]<len(seq)'),('inserts after requested index','seq.insert(a[0],a[1])','seq.insert(a[0]+1,a[1])')],
146:[('get does not refresh recency','frequency[key]+=1;stamp[key]=tick',"frequency[key]+=1\n    if op=='put':stamp[key]=tick"),('evicts most recent','victim=min(cache','victim=max(cache')],
460:[('evicts by recency regardless of frequency','frequency[x] if pid==460 else 0','0'),('put updates do not increment frequency','frequency[key]+=1;stamp[key]=tick',"frequency[key]+=int(op=='get' or frequency[key]==0);stamp[key]=tick")],
703:[('returns largest rather than kth','sorted(seq,reverse=True)[ctor[0]-1]','max(seq)'),('drops repeated values','sorted(seq,reverse=True)[ctor[0]-1]','sorted(set(seq),reverse=True)[min(ctor[0]-1,len(set(seq))-1)]')],
1146:[('reads current state rather than snapshot','snapshots[a[1]].get(a[0],0)','cache.get(a[0],0)'),('one based snapshot IDs','value=len(snapshots);','value=len(snapshots)+1;')],
2080:[('excludes right endpoint','a[0]:a[1]+1','a[0]:a[1]'),('counts entire array','ctor[0][a[0]:a[1]+1]','ctor[0]')],
362:[('includes expired boundary','a[0]-300<t<=a[0]','a[0]-300<=t<=a[0]'),('deduplicates same second hits','for t in history','for t in set(history)')],
676:[('accepts exact matches','zip(w,a[0]))==1','zip(w,a[0]))<=1'),('only checks length','sum(x!=y for x,y in zip(w,a[0]))==1','True')],
745:[('chooses smallest matching index','value=max((i for i,w in enumerate(words)','value=min((i for i,w in enumerate(words)'),('matches prefix only','w.startswith(a[0]) and w.endswith(a[1])','w.startswith(a[0])')],
1166:[('ignores missing parent',"path not in paths and (path.rsplit('/',1)[0]=='' or path.rsplit('/',1)[0] in paths)",'path not in paths'),('overwrites existing paths',"path not in paths and (path.rsplit('/',1)[0]=='' or path.rsplit('/',1)[0] in paths)","(path.rsplit('/',1)[0]=='' or path.rsplit('/',1)[0] in paths)")],
}

def mutants(pid):
 result=[]
 for name,old,new in MUTATIONS[pid]:
  source=inspect.getsource(model);assert old in source
  source='import sys,json\n'+source.replace(old,new)+'\n'+PARSE+f'\nresult=model({pid},args)\n'
  source+="print(len(result));print(' '.join('null' if v is None else str(v) for v in result))\n"
  result.append(dict(name=name,source=source))
 return result

def make(pid):
 zh,en,dz,de=TEXT[pid];rng=random.Random(pid);edges=[[[CLASSES[pid]]+[op for op,a in calls],[ctor]+[a for op,a in calls]] for ctor,calls in CASES[pid]]+[random_args(pid,rng) for _ in range(28)]
 example=encode(edges[0]);example_out=model(pid,edges[0]);display=str(len(example_out))+'\n'+' '.join('null' if x is None else str(x) for x in example_out)
 helpers='import sys,json\n'+inspect.getsource(model)+'\n'+PARSE+'\n'
 emit="\nprint(len(result));print(' '.join('null' if v is None else str(v) for v in result))\n"
 return dict(designClass=CLASSES[pid],designMethods=METHODS[pid],titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh='输入恰好两行 JSON：第一行操作名数组，第二行对应参数数组。首项必须是构造器 '+CLASSES[pid]+'，对应其构造参数；无参数方法用 []。例如：\n'+example,inputEn='Exactly two JSON lines: operation names, then matching argument arrays. First operation is constructor '+CLASSES[pid]+' with its constructor arguments; no-argument calls use []. Example:\n'+example,outputZh='第一行输出结果数量（包含构造器），第二行按调用顺序输出 null 或整数。构造器和 void 方法用 null，布尔用 1/0。上述示例输出：\n'+display,outputEn='Print the result count including construction, then null/integer tokens in call order. Constructor and void results are null; booleans are 1/0. Example output:\n'+display,difficulty='困难' if pid in (460,745) else '简单' if pid in (225,232,703) else '中等',resultKind='nullable-integer-array',outputLimit=2048,edges=edges,pressure=pressure(pid),random_args=lambda r:random_args(pid,r),oracle=lambda a:model(pid,a),validate=lambda a:validate(pid,a),encode=encode,parse=PARSE,mutants=mutants(pid))
PROBLEMS={pid:make(pid) for pid in IDS}
