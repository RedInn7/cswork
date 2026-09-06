"""Mixed-result design traces with independent small state-machine oracles."""
import inspect,json,random,string
from collections import Counter
from complex_design_semantics import IDS,CLASSES,METHODS
from tree_codec import TreeNode,to_level_order,valid_tree
LIMIT={173:100000,1472:5000,981:200000,2353:20000,295:50000,588:300,432:50000,380:200000,381:200000,297:1,449:1}

def oracle_model(pid,args,wrong=0):
 ops,params=args;ctor=params[0];out=[None];seq=[];left=[];right=[];versions=[];foods={};counts={};dirs={'/'};files={};draw=0
 if pid==173:seq=sorted(v for v in ctor[0] if v is not None);seq=seq[::-1] if wrong==1 else seq
 if pid==1472:left=ctor[:]
 if pid==2353:foods={f:[c,r] for f,c,r in zip(*ctor)}
 for op,p in zip(ops[1:],params[1:]):
  result=None
  if pid==173:
   if op=='next':result=seq.pop(0)
   else:result=int(len(seq)>(1 if wrong==2 else 0))
  elif pid==1472:
   if op=='visit':left.append(p[0]);right=[] if wrong!=1 else right
   elif op=='back':
    for _ in range(min(p[0],len(left)-1)):right.append(left.pop())
    result=left[-1]
   else:
    for _ in range(min(p[0],len(right))):left.append(right.pop())
    result=left[0] if wrong==2 else left[-1]
  elif pid==981:
   if op=='set':versions.append((p[0],p[1],p[2]))
   else:
    options=[(t,v) for k,v,t in versions if k==p[0] and (t<p[1] if wrong==1 else t<=p[1])]
    result=(min(options) if wrong==2 else max(options))[1] if options else ''
  elif pid==2353:
   if op=='changeRating':foods[p[0]][1]=p[1]
   else:
    choices=[f for f,(c,r) in foods.items() if c==p[0]]
    if wrong==1:result=min(choices,key=lambda f:(foods[f][1],f))
    elif wrong==2:result=max(choices,key=lambda f:(foods[f][1],f))
    else:result=min(choices,key=lambda f:(-foods[f][1],f))
  elif pid==295:
   if op=='addNum':seq.append(p[0])
   else:
    ordered=sorted(seq);n=len(seq);result=float(ordered[n//2]) if n%2 or wrong==1 else (ordered[n//2-1]+ordered[n//2])/2
    if wrong==2:result=float(int(result))
  elif pid==588:
   path=p[0]
   if op=='mkdir':
    parts=path.split('/')[1:]
    for i in range(1,len(parts)+1):dirs.add('/'+'/'.join(parts[:i]))
   elif op=='addContentToFile':files[path]=p[1] if wrong==1 else files.get(path,'')+p[1]
   elif op=='readContentFromFile':result=files[path]
   else:
    if path in files:result=[path.rsplit('/',1)[1]]
    else:
     prefix=path.rstrip('/')+'/';result=sorted({name[len(prefix):].split('/')[0] for name in dirs|files.keys() if name.startswith(prefix) and name!=path and name[len(prefix):]})
     if wrong==2:result.reverse()
  elif pid==432:
   if op=='inc':counts[p[0]]=counts.get(p[0],0)+1
   elif op=='dec':
    counts[p[0]]-=1
    if counts[p[0]]==0:del counts[p[0]]
   else:
    if wrong==1:result=min(counts,default='')
    elif wrong==2:result=max(counts,key=counts.get,default='') if op=='getMinKey' else min(counts,key=counts.get,default='')
    else:result=(max if op=='getMaxKey' else min)(counts,key=counts.get,default='')
  elif pid in (380,381):
   if op!='getRandom':draw=0
   if op=='insert':
    result=int(counts.get(p[0],0)==0);counts[p[0]]=counts.get(p[0],0)+1 if pid==381 else 1
    if wrong==1:result=1
   elif op=='remove':
    result=int(counts.get(p[0],0)>0)
    if result:
     counts[p[0]]-=1
     if not counts[p[0]]:del counts[p[0]]
   else:
    population=sorted(counts) if wrong==4 else [v for v in sorted(counts) for _ in range(counts[v])]
    result=2147483648 if wrong==2 else min(counts) if wrong==3 else population[draw%len(population)]
    draw+=1
  elif pid in (297,449):result=[] if wrong==1 else p[0][::-1] if wrong==2 else p[0][:]
  out.append(result)
 return out

def trace(pid,ctor,calls):return [[CLASSES[pid]]+[op for op,a in calls],[ctor]+[a for op,a in calls]]
def name(i):
 out=[]
 for _ in range(4):out.append(chr(97+i%26));i//=26
 return ''.join(reversed(out))
def bst(values):
 if not values:return []
 root=TreeNode();todo=[(root,0,len(values))]
 while todo:
  u,l,r=todo.pop();m=(l+r)//2;u.val=values[m]
  if l<m:u.left=TreeNode();todo.append((u.left,l,m))
  if m+1<r:u.right=TreeNode();todo.append((u.right,m+1,r))
 return to_level_order(root)

def random_args(pid,r):
 if pid==173:
  vals=sorted(r.sample(range(50),r.randint(1,9)));calls=[]
  for _ in vals:
   if r.random()<.7:calls.append(('hasNext',[]))
   calls.append(('next',[]))
  calls.append(('hasNext',[]));return trace(pid,[bst(vals)],calls)
 if pid==1472:
  calls=[(r.choice(['visit','back','forward']),None) for _ in range(20)]
  return trace(pid,['home'],[(op,[r.choice(['a','b','c'])] if op=='visit' else [r.randint(1,4)]) for op,_ in calls])
 if pid==981:
  calls=[];clock=0
  for _ in range(20):
   if r.random()<.5:clock+=r.randint(1,3);calls.append(('set',[r.choice(['a','b']),r.choice(['x','y','z']),clock]))
   else:calls.append(('get',[r.choice(['a','b','c']),r.randint(1,max(1,clock+3))]))
  return trace(pid,[],calls)
 if pid==2353:
  ctor=[['a','b','c'],['x','x','y'],[r.randint(1,8) for _ in range(3)]]
  calls=[('changeRating',[r.choice(ctor[0]),r.randint(1,8)]) if r.random()<.5 else ('highestRated',[r.choice(['x','y'])]) for _ in range(20)];return trace(pid,ctor,calls)
 if pid==295:
  calls=[('addNum',[r.randint(-9,9)])]
  calls += [('addNum',[r.randint(-9,9)]) if r.random()<.6 else ('findMedian',[]) for _ in range(20)];return trace(pid,[],calls)
 if pid==588:
  calls=[('mkdir',['/a']),('addContentToFile',['/a/f','x'])]
  for _ in range(20):calls.append(r.choice([('ls',['/']),('ls',['/a']),('ls',['/a/f']),('addContentToFile',['/a/f',r.choice(['y',' ','\n'])]),('readContentFromFile',['/a/f'])]))
  return trace(pid,[],calls)
 if pid in (432,380,381):
  calls=[];counts={}
  for _ in range(25):
   if pid==432:
    op=r.choice(['inc','getMinKey','getMaxKey']+(['dec'] if counts else []));v=r.choice(list(counts)) if op=='dec' else r.choice(['a','b','c'])
    if op=='inc':counts[v]=counts.get(v,0)+1
    elif op=='dec':counts[v]-=1;counts={k:n for k,n in counts.items() if n}
    calls.append((op,[v] if op in ('inc','dec') else []))
   else:
    op=r.choice(['insert','remove']+(['getRandom'] if counts else []));v=r.randint(-3,3)
    if op=='insert':counts[v]=counts.get(v,0)+1 if pid==381 else 1
    elif op=='remove' and v in counts:counts[v]-=1;counts={k:n for k,n in counts.items() if n}
    calls.append((op,[] if op=='getRandom' else [v]))
  return trace(pid,[],calls)
 values=sorted(r.sample(range(30),r.randint(0,9)));tokens=bst(values)
 if pid==297:tokens=[None if v is None else r.randint(-5,5) for v in tokens]
 return trace(pid,[],[('roundTrip',[tokens])])

def validate(pid,args):
 ops,params=args
 assert type(ops)is list and type(params)is list and len(ops)==len(params) and ops and ops[0]==CLASSES[pid] and 0<=len(ops)-1<=LIMIT[pid]
 assert all(type(p)is list for p in params)
 def num(v,lo,hi):assert type(v)is int and lo<=v<=hi
 def text(v,lo,hi,letters):assert type(v)is str and lo<=len(v)<=hi and all(c in letters for c in v)
 ctor=params[0];size=0;lasttime=0;counts={};foods={};cuisines=set();dirs={'/'};files=set();left=0
 if pid==173:
  assert len(ctor)==1;size=valid_tree(ctor[0],min_nodes=1,max_nodes=100000,min_value=0,max_value=1000000,bst=True)
 elif pid==1472:assert len(ctor)==1;text(ctor[0],1,20,string.ascii_lowercase+'.')
 elif pid==2353:
  assert len(ctor)==3 and all(type(v)is list for v in ctor);assert 1<=len(ctor[0])<=20000 and len(ctor[0])==len(ctor[1])==len(ctor[2]) and len(set(ctor[0]))==len(ctor[0])
  for f,c,v in zip(*ctor):text(f,1,10,string.ascii_lowercase);text(c,1,10,string.ascii_lowercase);num(v,1,10**8);foods[f]=c;cuisines.add(c)
 else:assert ctor==[]
 for op,p in zip(ops[1:],params[1:]):
  assert op in METHODS[pid]
  arities={'next':0,'hasNext':0,'visit':1,'back':1,'forward':1,'set':3,'get':2,'changeRating':2,'highestRated':1,'addNum':1,'findMedian':0,'ls':1,'mkdir':1,'addContentToFile':2,'readContentFromFile':1,'inc':1,'dec':1,'getMinKey':0,'getMaxKey':0,'insert':1,'remove':1,'getRandom':0,'roundTrip':1};assert len(p)==arities[op]
  if pid==173:
   if op=='next':assert size>0;size-=1
  elif pid==1472:
   if op=='visit':text(p[0],1,20,string.ascii_lowercase+'.')
   else:num(p[0],1,100)
  elif pid==981:
   text(p[0],1,100,string.ascii_lowercase+string.digits);t=p[2] if op=='set' else p[1];num(t,1,10**7)
   if op=='set':text(p[1],1,100,string.ascii_lowercase+string.digits);assert t>lasttime;lasttime=t
  elif pid==2353:
   if op=='changeRating':assert p[0] in foods;num(p[1],1,10**8)
   else:assert p[0] in cuisines
  elif pid==295:
   if op=='addNum':num(p[0],-100000,100000);size+=1
   else:assert size>0
  elif pid==588:
   path=p[0];assert type(path)is str and 1<=len(path)<=100 and path.startswith('/') and (path=='/' or not path.endswith('/'))
   pieces=path.split('/')[1:]
   if path!='/':assert all(part and all(c in string.ascii_lowercase for c in part) for part in pieces)
   if op=='mkdir':
    assert path not in dirs and path not in files
    for i in range(1,len(pieces)+1):part='/'+'/'.join(pieces[:i]);assert part not in files;dirs.add(part)
   elif op=='addContentToFile':assert path not in dirs and (path.rsplit('/',1)[0] or '/') in dirs;assert type(p[1])is str and 1<=len(p[1])<=50;files.add(path)
   elif op=='ls':assert path in dirs or path in files
   else:assert path in files
  elif pid==432:
   if p:text(p[0],1,10,string.ascii_lowercase)
   if op=='inc':counts[p[0]]=counts.get(p[0],0)+1
   if op=='dec':assert counts.get(p[0],0)>0;counts[p[0]]-=1
  elif pid in (380,381):
   if p:num(p[0],-2**31,2**31-1)
   if op=='insert':counts[p[0]]=counts.get(p[0],0)+1 if pid==381 else 1
   elif op=='remove' and counts.get(p[0],0):counts[p[0]]-=1
   elif op=='getRandom':assert any(counts.values())
  elif pid in (297,449):valid_tree(p[0],max_nodes=10000,min_value=-1000 if pid==297 else 0,max_value=1000 if pid==297 else 10000,bst=pid==449)
 if pid in (297,449):assert len(ops)==2
 return True

CASES={173:([bst([3,7,9,15,20])],[('next',[]),('next',[]),('hasNext',[]),('next',[]),('next',[]),('hasNext',[]),('next',[]),('hasNext',[])]),1472:(['home'],[('visit',['a']),('visit',['b']),('back',[1]),('visit',['c']),('forward',[1]),('back',[1]),('forward',[1])]),981:([],[('set',['a','x',1]),('get',['a',1]),('set',['a','y',4]),('get',['a',5])]),2353:([['a','b','c'],['x','x','x'],[1,3,3]],[('highestRated',['x']),('changeRating',['a',5]),('highestRated',['x'])]),295:([],[('addNum',[-1]),('addNum',[0]),('findMedian',[]),('addNum',[3]),('findMedian',[])]),588:([],[('mkdir',['/z']),('mkdir',['/a']),('ls',['/']),('addContentToFile',['/a/f','ab']),('addContentToFile',['/a/f','cd']),('readContentFromFile',['/a/f'])]),432:([],[('inc',['a']),('inc',['b']),('inc',['b']),('getMaxKey',[]),('getMinKey',[])]),380:([],[('insert',[1]),('insert',[1]),('getRandom',[]),('remove',[1]),('remove',[1])]),381:([],[('insert',[1]),('insert',[1]),('remove',[1]),('getRandom',[])]),297:([],[('roundTrip',[[1,2,3,None,4]])]),449:([],[('roundTrip',[[2,1,3]])])}
EDGES={pid:[trace(pid,*CASES[pid])] for pid in IDS}
EDGES[173].append(trace(173,[[1]],[('hasNext',[]),('next',[]),('hasNext',[])]))
EDGES[588].append(trace(588,[],[('ls',['/']),('mkdir',['/a/b']),('ls',['/']),('ls',['/a']),('ls',['/a/b'])]))
EDGES[432].append(trace(432,[],[('getMaxKey',[]),('getMinKey',[]),('inc',['a']),('dec',['a']),('getMaxKey',[])]))

def pressure(pid):
 if pid==173:return [(trace(pid,[bst(list(range(100000)))],[('next',[])]*100000),[None]+list(range(100000)))]
 if pid==1472:return [(trace(pid,['a'*20],[('back',[100])]*5000),[None]+['a'*20]*5000)]
 if pid==981:return [(trace(pid,[],[('set',['a','x'*100,1])]+[('get',['a',1])]*199999),[None,None]+['x'*100]*199999)]
 if pid==2353:
  names=[name(i) for i in range(20000)];return [(trace(pid,[names,['x']*20000,[10**8]*20000],[('highestRated',['x'])]*20000),[None]+[names[0]]*20000)]
 if pid==295:return [(trace(pid,[],[('addNum',[100000])]*25000+[('findMedian',[])]*25000),[None]*25001+[100000.0]*25000)]
 if pid==588:return [(trace(pid,[],[('mkdir',['/a'])]+[('addContentToFile',['/f','x'*50])]*149+[('readContentFromFile',['/f'])]*150),[None]*151+['x'*7450]*150)]
 if pid==432:return [(trace(pid,[],[('inc',['a'])]+[('getMaxKey',[])]*49999),[None,None]+['a']*49999)]
 if pid in (380,381):
  upper=(trace(pid,[],[('insert',[1])]*100000+[('getRandom',[])]*100000),[None,1]+[0]*99999+[1]*100000)
  values=[1,2,3,4] if pid==380 else [1,2,2,3,3,3,4,4,4,4]
  stable=trace(pid,[],[('insert',[v]) for v in values]+[('getRandom',[])]*8000)
  # Construct exact weighted frequencies independently of the small oracle.
  results=[None]+[int(v not in values[:i]) for i,v in enumerate(values)]+(values*(8000//len(values)))
  return [upper,(stable,results)]
 tokens=[1000]*10000 if pid==297 else bst(list(range(10000)));return [(trace(pid,[],[('roundTrip',[tokens])]),[None,tokens])]

TITLE={173:('搜索树迭代器','BST Iterator'),1472:('浏览历史','Browser History'),981:('按时间读取键值','Time-Based Key Values'),2353:('菜系评分系统','Food Ratings'),295:('数据流中位数','Streaming Median'),588:('内存文件系统','In-Memory File System'),432:('键计数极值','All-One Key Counts'),380:('随机集合','Randomized Set'),381:('含重复值的随机集合','Randomized Collection'),297:('二叉树序列化往返','Binary Tree Serialization Round Trip'),449:('搜索树序列化往返','BST Serialization Round Trip')}
DESC={173:('构造器接收BST，next依次返回中序值，hasNext返回是否还有下一项。','Construct from a BST; next returns successive inorder values and hasNext reports availability.'),1472:('visit访问新页并清空前进记录；back/forward最多移动steps页并返回当前网址，到边界就停止。','visit opens a page and discards forward history; back/forward move at most steps pages and return the current URL, stopping at boundaries.'),981:('set(key,value,timestamp)记录值；get返回不晚于查询时间的最新值，不存在为空串。','set(key,value,timestamp) stores a version; get returns the latest version not after the query timestamp, or an empty string.'),2353:('changeRating修改食物评分；highestRated返回指定菜系评分最高者，评分并列取字典序最小食物名。','changeRating updates a food; highestRated chooses the cuisine’s highest rating, breaking ties by lexicographically smallest food name.'),295:('addNum添加整数；findMedian返回全部已添加值的中位数，偶数个取中间两值平均，允许绝对误差1e-5。','addNum inserts an integer; findMedian returns the median, averaging the two middle values for even counts. Absolute error up to 1e-5 is accepted.'),588:('mkdir递归创建目录；addContentToFile创建或追加文件；readContentFromFile读全文；ls列出目录直接子项并按字典序排序，若路径是文件则返回仅含文件名的列表。','mkdir creates directories recursively; addContentToFile creates or appends; readContentFromFile returns full contents; ls lists immediate children lexicographically, or a singleton filename for a file path.'),432:('inc把key计数加1；dec减1并删除零计数；getMaxKey/getMinKey返回任意最高/最低计数的key，空结构返回空串。','inc increments a key; dec decrements and removes zero counts; getMaxKey/getMinKey may return any key with an extreme count, or an empty string when empty.'),380:('insert在原来不存在时插入并返回1，否则0；remove删除存在的元素返回1，不存在0；getRandom必须对当前各元素等概率抽样。平台检查成员合法性，并在至少2000次连续、状态不变的抽样窗口中做频率检验，不要求固定随机序列。','insert returns 1 only for a newly added value; remove returns 1 only when present; getRandom must sample current elements uniformly. The platform checks membership and frequencies in unchanged-state windows of at least 2000 consecutive draws, without imposing a fixed random sequence.'),381:('允许重复值；insert总是加入一份，仅原来不存在时返回1；remove只删除一份，存在返回1；getRandom按当前出现次数占总份数的比例抽样。平台检查成员合法性，并在至少2000次连续、状态不变的抽样窗口中做频率检验，不要求固定随机序列。','Duplicates are allowed: insert always adds one copy and returns 1 only if previously absent; remove removes one copy and reports presence; getRandom samples each value in proportion to its current multiplicity. The platform checks membership and frequencies in unchanged-state windows of at least 2000 consecutive draws, without requiring a fixed random sequence.'),297:('操作roundTrip(tree)要求用自己的serialize再deserialize，输出往返后的规范树结构；具体序列化文本自由，不要求任何固定字符串格式。','roundTrip(tree) serializes then deserializes using your implementation and outputs the canonical reconstructed tree. The serialized text format is unrestricted.'),449:('对BST执行roundTrip(tree)：使用自己的serialize再deserialize并返回原树结构，序列化文本格式不受限制。','roundTrip(tree) serializes and deserializes a BST and returns its original structure; the serialized text format is unrestricted.')}
DOMAIN={173:('BST有1–100000节点，值0–1000000，next调用时保证还有节点；最多100000次方法调用。','BST has 1–100000 nodes with values 0–1000000; next is called only when available; at most 100000 calls.'),1472:('网址长度1–20，仅小写字母或点，steps为1–100；最多5000次调用。','URLs have length 1–20 using lowercase letters or dots; steps is 1–100; at most 5000 calls.'),981:('key/value长度1–100，仅小写字母和数字；时间1–10000000，所有set时间全局严格递增；最多200000次调用。','Keys/values have length 1–100 over lowercase letters and digits; timestamps are 1–10000000 and all set timestamps strictly increase globally; at most 200000 calls.'),2353:('构造器foods/cuisines/ratings长度相同为1–20000，食物名互异；名字1–10个小写字母，评分1–100000000；查询名字均存在，最多20000次调用。','Constructor foods/cuisines/ratings have equal length 1–20000 and distinct food names; names use 1–10 lowercase letters, ratings are 1–100000000; queried names exist; at most 20000 calls.'),295:('数值[-100000,100000]，findMedian前至少添加一个值；最多50000次调用。','Values lie in [-100000,100000], with at least one insertion before findMedian; at most 50000 calls.'),588:('路径1–100字符，绝对路径，以/开头，除根外不能以/结尾；目录和文件名仅小写字母，同目录不重名；所有操作合法，mkdir目标目录保证不存在，文件父目录已存在；内容长度1–50，最多300次调用。','Paths have length 1–100, start with / and end without / except for root. Names use lowercase letters with no sibling duplicates; operations are valid, each mkdir target does not yet exist, and file parents exist; content length is 1–50; at most 300 calls.'),432:('key为1–10个小写字母；dec的key保证存在；最多50000次调用。','Keys use 1–10 lowercase letters; dec always targets an existing key; at most 50000 calls.'),380:('元素是32位有符号整数，getRandom前保证非空；最多200000次调用。','Values are signed 32-bit integers; getRandom is called only when nonempty; at most 200000 calls.'),381:('元素是32位有符号整数，getRandom前保证非空；最多200000次调用。','Values are signed 32-bit integers; getRandom is called only when nonempty; at most 200000 calls.'),297:('恰好一次roundTrip，树有0–10000节点，值[-1000,1000]。','Exactly one roundTrip, with 0–10000 tree nodes and values in [-1000,1000].'),449:('恰好一次roundTrip，严格BST有0–10000节点，值0–10000。','Exactly one roundTrip of a strict BST with 0–10000 nodes and values 0–10000.')}
WRONG={173:('把中序次序颠倒','hasNext提前结束'),1472:('visit未清空前进历史','forward返回错误网址'),981:('漏掉相等时间戳','选择最早而非最新版本'),2353:('选择最低评分','同分选字典序最大'),295:('偶数个只取右中位','把小数部分截断'),588:('追加误写为覆盖','ls反向排序'),432:('只按字典序返回','颠倒极大极小'),380:('重复insert也返回1','random返回不存在的值','random固定返回最小值'),381:('重复insert也返回1','random返回不存在的值','random固定返回最小值','random错误地对不同值等概率'),297:('丢弃整棵树','反转层序序列'),449:('丢弃整棵树','反转层序序列')}

def make(pid):
 zh,en=TITLE[pid];dz,de=DESC[pid];iz,ie=DOMAIN[pid]
 desc='输入一行JSON [operations,parameters]，第一项操作必须为构造器'+CLASSES[pid]+'，参数数组一一对应，无参数用[]。'+iz
 eng='Input one JSON line [operations,parameters], starting with constructor '+CLASSES[pid]+' and matching argument arrays; use [] for no arguments. '+ie
 if pid in (173,297,449):desc+='树用规范层序整数/null数组，空树[]，去掉末尾null。';eng+=' Trees use canonical level-order integer/null arrays, [] for empty, without trailing nulls.'
 oz='输出一行JSON结果数组，与操作一一对应。构造器和void方法为null，布尔为1/0；其余保留整数、小数、字符串、字符串列表或树数组类型。'
 oe='Output one JSON result array aligned with operations. Constructor and void methods produce null, booleans produce 1/0, and other results retain numeric, string, string-list or tree-array types.'
 if pid in (297,449):
  tree='[1,2,3,null,4]' if pid==297 else '[2,1,3]'
  example='[["Codec","roundTrip"],[[],['+tree+']]]'
  serialized=json.dumps([tree],separators=(',',':'))
  phase1='{"operation":"serialize","trees":['+tree+']}'
  phase2='{"operation":"deserialize","data":'+serialized+'}'
  decoded='['+tree+']'
  shown='[null,'+tree+']'
  dz='实现树的serialize和deserialize两个操作，往返后必须保留所有节点值和原树结构，序列化字符串格式由你决定。平台会在两个全新、互相隔离的进程中运行同一份提交程序：第一次把树交给serialize，第二次只把你产生的字符串交给deserialize，不传原树，也不保留前一次运行的内存。两阶段合计使用本题显示的时间限制，标准输出合计不得超过2 MiB（2048 KiB）。'
  de='Implement both serialize and deserialize so that a round trip preserves every node value and the original tree structure. Choose your own serialized string format. The platform runs the same submitted program twice in fresh, isolated processes: first serialize receives trees, then deserialize receives only the strings you produced, without the original trees or memory from the first run. Both phases share the displayed time limit and a combined standard-output limit of 2 MiB (2048 KiB).'
  desc='网页样例和自定义测试框接收一行JSON [operations,parameters]，包含无参数构造器Codec和恰好一次roundTrip(tree)。这份网页输入不是提交程序实际收到的stdin。'+iz+'树用规范层序整数/null数组：仅非空节点按顺序占用左右孩子位置，去掉末尾null，空树为[]。平台转换为两次实际stdin：第一阶段一行JSON {"operation":"serialize","trees":[树数组,...]}；第二阶段一行JSON {"operation":"deserialize","data":[你输出的字符串,...]}，其中只含第一阶段的序列化字符串。\n\n示例网页输入：`'+example+'`。第一阶段stdin：`'+phase1+'`。若采用JSON文本作为自己的序列化格式，可输出 `'+serialized+'`；第二阶段stdin便是 `'+phase2+'`，应输出 `'+decoded+'`。此字符串格式只是示例，不是要求。'
  eng='The web example and custom-test box accept one JSON line [operations,parameters], containing the no-argument Codec constructor and exactly one roundTrip(tree). This web input is not the actual stdin delivered to your submitted program. '+ie+' Trees are canonical level-order integer/null arrays: only non-null parents consume successive left/right child positions; omit trailing nulls and use [] for an empty tree. The platform converts the trace into two actual stdin messages: phase one is one JSON line {"operation":"serialize","trees":[treeArray,...]}; phase two is one JSON line {"operation":"deserialize","data":[yourString,...]}, containing only your serialized strings from phase one.\n\nExample web input: `'+example+'`. Phase-one stdin: `'+phase1+'`. If JSON text is your chosen serialization format, you may output `'+serialized+'`; phase-two stdin is then `'+phase2+'`, for which you output `'+decoded+'`. This string format is illustrative, not mandatory.'
  oz='实际程序stdout：serialize阶段输出一行JSON字符串数组，与trees逐项对应；deserialize阶段输出一行JSON树数组列表，与data逐项对应，每棵树使用上述规范层序表示。所有JSON字符串须正确转义，每个阶段输出后换行。两个阶段共用2 MiB输出预算。网页将往返结果组合显示为[null,解码后的树,...]，null对应构造器；这不是程序任一阶段的stdout格式。上述示例的页面结果为 `'+shown+'`。'
  oe='Actual program stdout: serialize prints one JSON array of strings aligned with trees; deserialize prints one JSON array of canonical tree arrays aligned with data. Escape JSON strings correctly and terminate each phase’s output with a newline. The two phases share the 2 MiB output budget. The page assembles [null,decodedTree,...], with null for the constructor; this is not the stdout format of either phase. The example’s displayed result is `'+shown+'`.'
 mut=[]
 for i,name_ in enumerate(WRONG[pid]):
  source='import sys,json\nfrom collections import Counter\n'+inspect.getsource(oracle_model)+f'\nargs=json.load(sys.stdin)\nprint(json.dumps(oracle_model({pid},args,{i+1}),separators=(",",":"),ensure_ascii=True))\n';mut.append(dict(name=name_,source=source))
 return dict(complexDesignId=pid,resultKind='string',titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=desc,inputEn=eng,outputZh=oz,outputEn=oe,difficulty='困难' if pid in (295,588,432,297) else '中等',outputLimit=32768 if pid==981 else 8192 if pid==588 else 2048,edges=EDGES[pid],pressure=[(a,json.dumps(v,separators=(',',':'),ensure_ascii=True)) for a,v in pressure(pid)],random_args=lambda r:random_args(pid,r),oracle=lambda a:json.dumps(oracle_model(pid,a),separators=(',',':'),ensure_ascii=True),validate=lambda a:validate(pid,a),encode=lambda a:json.dumps(a,separators=(',',':'),ensure_ascii=True)+'\n',parse='args=json.load(sys.stdin)',mutants=mut)
PROBLEMS={pid:make(pid) for pid in IDS}
