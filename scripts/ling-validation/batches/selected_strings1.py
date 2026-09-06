"""Nine original string-structure batches. Not registered in the core yet."""
import itertools,json,random,inspect,string,re
from collections import Counter,deque
from tree_codec import valid_tree
from string_structures import format_string_structure
IDS=[49,249,68,257,721,131,51,130,37]

SUDOKU_BASE=['53..7....','6..195...','.98....6.','8...6...3','4..8.3..1','7...2...6','.6....28.','...419..5','....8..79']
SUDOKU_HARD=['.......1.','4........','.2.......','....5.4.7','..8...3..','..1.9....','3..4..2..','.5.1.....','...8.6...']

def sudoku_solutions(board,limit=2):
 """Constraint sets + smallest-domain search; counts to two to prove uniqueness."""
 grid=[row[:] for row in board];rows=[set() for _ in range(9)];cols=[set() for _ in range(9)];boxes=[set() for _ in range(9)];empty=[]
 for i in range(9):
  for j in range(9):
   v=grid[i][j];b=i//3*3+j//3
   if v=='.':empty.append((i,j));continue
   if v in rows[i] or v in cols[j] or v in boxes[b]:return []
   rows[i].add(v);cols[j].add(v);boxes[b].add(v)
 answers=[];digits=set('123456789')
 def visit():
  if len(answers)>=limit:return
  if not empty:answers.append([row[:] for row in grid]);return
  choices=[digits-rows[i]-cols[j]-boxes[i//3*3+j//3] for i,j in empty];k=min(range(len(empty)),key=lambda k:len(choices[k]));options=choices[k]
  i,j=empty.pop(k);b=i//3*3+j//3
  for v in sorted(options):
   grid[i][j]=v;rows[i].add(v);cols[j].add(v);boxes[b].add(v);visit();rows[i].remove(v);cols[j].remove(v);boxes[b].remove(v)
   if len(answers)>=limit:break
  grid[i][j]='.';empty.insert(k,(i,j))
 visit();return answers

def sudoku_bitmask(board):
 """Separate integer bitmask solver for authored-model cross checks."""
 grid=[row[:] for row in board];r=[0]*9;c=[0]*9;b=[0]*9;empty=[]
 for i in range(9):
  for j in range(9):
   if grid[i][j]=='.':empty.append((i,j))
   else:
    bit=1<<(int(grid[i][j])-1);r[i]|=bit;c[j]|=bit;b[i//3*3+j//3]|=bit
 def visit(k):
  if k==len(empty):return True
  best=min(range(k,len(empty)),key=lambda p:(511&~(r[empty[p][0]]|c[empty[p][1]]|b[empty[p][0]//3*3+empty[p][1]//3])).bit_count())
  empty[k],empty[best]=empty[best],empty[k];i,j=empty[k];box=i//3*3+j//3;options=511&~(r[i]|c[j]|b[box])
  while options:
   bit=options&-options;options-=bit;r[i]|=bit;c[j]|=bit;b[box]|=bit;grid[i][j]=str(bit.bit_length())
   if visit(k+1):return True
   r[i]^=bit;c[j]^=bit;b[box]^=bit
  grid[i][j]='.';empty[k],empty[best]=empty[best],empty[k];return False
 assert visit(0);return grid

def tree_paths(tokens):
 """Queue of immutable value paths; independent of TreeNode transport helpers."""
 queue=deque([(0,[tokens[0]])]);i=1;result=[]
 while queue:
  _,path=queue.popleft();children=[]
  for _ in range(2):
   if i==len(tokens):break
   value=tokens[i];i+=1
   if value is not None:children.append((i-1,path+[value]))
  if not children:result.append('->'.join(map(str,path)))
  queue.extend(children)
 return result

def oracle(pid,a):
 x=a[0]
 if pid==37:
  solutions=sudoku_solutions(x);assert len(solutions)==1;return solutions[0]
 if pid in (49,249):
  pending=list(x);groups=[]
  while pending:
   first=pending.pop();group=[first];rest=[]
   for w in pending:
    same=Counter(first)==Counter(w) if pid==49 else len(first)==len(w) and len({(ord(u)-ord(v))%26 for u,v in zip(first,w)})==1
    (group if same else rest).append(w)
   groups.append(group);pending=rest
  return groups
 if pid==68:
  width=a[1];out=[];i=0
  while i<len(x):
   legal=[j for j in range(i+1,len(x)+1) if sum(map(len,x[i:j]))+(j-i-1)<=width];j=max(legal);words=x[i:j]
   if j==len(x) or len(words)==1:line=' '.join(words);out.append(line+' '*(width-len(line)))
   else:
    spaces=width-sum(map(len,words));gaps=[0]*(len(words)-1)
    for k in range(spaces):gaps[k%len(gaps)]+=1
    out.append(''.join(word+' '*gaps[k] if k<len(gaps) else word for k,word in enumerate(words)))
   i=j
  return out
 if pid==257:return tree_paths(x)
 if pid==721:
  remaining=set(range(len(x)));result=[]
  while remaining:
   group={remaining.pop()};emails=set(x[next(iter(group))][1:]);change=True
   while change:
    change=False
    for i in list(remaining):
     if emails.intersection(x[i][1:]):remaining.remove(i);group.add(i);emails.update(x[i][1:]);change=True
   result.append([x[next(iter(group))][0]]+sorted(emails))
  return result
 if pid==131:
  result=[]
  for mask in range(1<<(len(x)-1)):
   bounds=[0]+[i+1 for i in range(len(x)-1) if mask>>i&1]+[len(x)];pieces=[x[l:r] for l,r in zip(bounds,bounds[1:])]
   if all(s==s[::-1] for s in pieces):result.append(pieces)
  return result
 if pid==51:
  return [['.'*c+'Q'+'.'*(x-c-1) for c in permutation] for permutation in itertools.permutations(range(x)) if len({i+c for i,c in enumerate(permutation)})==x and len({i-c for i,c in enumerate(permutation)})==x]
 if pid==130:
  m,n=len(x),len(x[0]);out=[r[:] for r in x];pending={(i,j) for i in range(m) for j in range(n) if x[i][j]=='O'}
  while pending:
   group={pending.pop()};changed=True
   while changed:
    extra={(i,j) for i,j in pending if any((i+u,j+v) in group for u,v in ((0,1),(0,-1),(1,0),(-1,0)))};changed=bool(extra);pending-=extra;group|=extra
   if all(0<i<m-1 and 0<j<n-1 for i,j in group):
    for i,j in group:out[i][j]='X'
  return out
 raise ValueError(pid)

def fast(pid,a):
 x=a[0]
 if pid==37:return sudoku_bitmask(x)
 if pid in (49,249):
  groups={}
  for w in x:
   key=''.join(sorted(w)) if pid==49 else tuple((ord(c)-ord(w[0]))%26 for c in w)
   groups.setdefault(key,[]).append(w)
  return list(groups.values())
 if pid==68:
  answer=[];i=0;w=a[1]
  while i<len(x):
   j=i;letters=0
   while j<len(x) and letters+len(x[j])+j-i<=w:letters+=len(x[j]);j+=1
   gaps=j-i-1
   if j==len(x) or not gaps:line=' '.join(x[i:j]);answer.append(line.ljust(w))
   else:
    base,extra=divmod(w-letters,gaps);answer.append(''.join(x[k]+(' '*(base+(k-i<extra)) if k<j-1 else '') for k in range(i,j)))
   i=j
  return answer
 if pid==257:
  # Parent links and leaf slots, independent of path queue in oracle.
  values=[x[0]];parents=[-1];children=[0];slots=deque([0,0])
  for v in x[1:]:
   p=slots.popleft()
   if v is not None:parents.append(p);values.append(v);children.append(0);children[p]+=1;slots.extend([len(values)-1]*2)
  out=[]
  for i,c in enumerate(children):
   if c:continue
   path=[]
   while i>=0:path.append(str(values[i]));i=parents[i]
   out.append('->'.join(path[::-1]))
  return out
 if pid==721:
  graph={};names={}
  for row in x:
   for email in row[1:]:names[email]=row[0];graph.setdefault(email,set()).update(row[1:])
  result=[];seen=set()
  for email in graph:
   if email in seen:continue
   todo=[email];seen.add(email);group=[]
   while todo:
    u=todo.pop();group.append(u)
    for v in graph[u]-seen:seen.add(v);todo.append(v)
   result.append([names[email]]+sorted(group))
  return result
 if pid==131:
  out=[]
  def dfs(i,path):
   if i==len(x):out.append(path);return
   for j in range(i+1,len(x)+1):
    if x[i:j]==x[i:j][::-1]:dfs(j,path+[x[i:j]])
  dfs(0,[]);return out
 if pid==51:
  out=[]
  def dfs(cols,left,right,path):
   if len(path)==x:out.append(['.'*c+'Q'+'.'*(x-c-1) for c in path]);return
   available=((1<<x)-1)&~(cols|left|right)
   while available:
    bit=available&-available;available-=bit;dfs(cols|bit,(left|bit)<<1,(right|bit)>>1,path+[bit.bit_length()-1])
  dfs(0,0,0,[]);return out
 if pid==130:
  m,n=len(x),len(x[0]);safe={(i,j) for i in range(m) for j in range(n) if x[i][j]=='O' and (i in (0,m-1) or j in (0,n-1))};q=deque(safe)
  while q:
   i,j=q.popleft()
   for u,v in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
    if 0<=u<m and 0<=v<n and x[u][v]=='O' and (u,v) not in safe:safe.add((u,v));q.append((u,v))
  return [['O' if (i,j) in safe else 'X' for j in range(n)] for i in range(m)]
 raise ValueError(pid)

def validate(pid,a):
 assert type(a)is list and len(a)==(2 if pid==68 else 1);x=a[0]
 def word(s,lo,hi,chars):assert type(s)is str and lo<=len(s)<=hi and all(c in chars for c in s)
 if pid in (49,249,68):
  assert type(x)is list and 1<=len(x)<={49:10000,249:200,68:300}[pid]
  for w in x:word(w,0 if pid==49 else 1,{49:100,249:50,68:20}[pid],string.ascii_lowercase if pid!=68 else string.ascii_letters+string.digits+string.punctuation)
  if pid==68:assert type(a[1])is int and 1<=a[1]<=100 and all(len(w)<=a[1] for w in x)
 elif pid==257:valid_tree(x,min_nodes=1,max_nodes=100,min_value=-100,max_value=100)
 elif pid==721:
  assert type(x)is list and 1<=len(x)<=1000;owner={}
  for row in x:
   assert type(row)is list and 2<=len(row)<=10;word(row[0],1,30,string.ascii_letters)
   for email in row[1:]:
    assert type(email)is str and 1<=len(email)<=30 and re.fullmatch(r'[A-Za-z0-9_+.-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+',email)
    assert email not in owner or owner[email]==row[0];owner[email]=row[0]
 elif pid==131:word(x,1,16,string.ascii_lowercase)
 elif pid==51:assert type(x)is int and 1<=x<=9
 elif pid==37:
  assert type(x)is list and len(x)==9 and all(type(row)is list and len(row)==9 and all(type(v)is str and v in '123456789.' and len(v)==1 for v in row) for row in x)
  assert len(sudoku_solutions(x))==1
 elif pid==130:
  assert type(x)is list and 1<=len(x)<=200 and type(x[0])is list and 1<=len(x[0])<=200
  assert all(type(row)is list and len(row)==len(x[0]) and all(v in ('X','O') for v in row) for row in x)


def random_args(pid,r):
 if pid==37:
  digits=r.sample(list('123456789'),9);mapping=dict(zip('123456789',digits));mapping['.']='.'
  rows=[3*band+i for band in r.sample(range(3),3) for i in r.sample(range(3),3)];cols=[3*band+i for band in r.sample(range(3),3) for i in r.sample(range(3),3)]
  board=[[mapping[SUDOKU_BASE[i][j]] for j in cols] for i in rows]
  if r.random()<.5:board=list(map(list,zip(*board)))
  return [board]

 if pid==49:return [[''.join(r.choice('abc') for _ in range(r.randint(0,6))) for _ in range(r.randint(1,10))]]
 if pid==249:return [[''.join(r.choice('abcyz') for _ in range(r.randint(1,6))) for _ in range(r.randint(1,10))]]
 if pid==68:
  width=r.randint(1,12);return [[''.join(r.choice('aBZ!?') for _ in range(r.randint(1,min(width,6)))) for _ in range(r.randint(1,10))],width]
 if pid==257:
  x=[r.randint(-3,3)];slots=2
  for _ in range(r.randint(0,8)):
   if not slots:break
   v=None if r.random()<.25 else r.randint(-3,3);x.append(v);slots-=1;slots+=2*(v is not None)
  while x[-1] is None:x.pop()
  return [x]
 if pid==721:return [[['Alex']+[f'e{j}@x.io' for j in r.sample(range(8),r.randint(1,4))] for _ in range(r.randint(1,8))]]
 if pid==131:return [''.join(r.choice('abc') for _ in range(r.randint(1,8)))]
 if pid==51:return [r.randint(1,7)]
 if pid==130:
  m,n=r.randint(1,5),r.randint(1,5)
  return [[[r.choice('XO') for _ in range(n)] for _ in range(m)]]

EDGE={
37:[[list(map(list,SUDOKU_BASE))],[list(map(list,SUDOKU_HARD))]],
49:[[['eat','tea','tan','ate','nat','bat']],[['','']],[['a','a','b']]],
249:[[['abc','bcd','acef','xyz','az','ba','a','z']],[['a','b','a']],[['ab','ac']]],
68:[[['This','is','an','example','of','text','justification.'],16],[['a','b','c','d','e'],6],[['long','word','x'],4],[['!','"','\\'],3]],
257:[[[1,2,3,None,5]],[[1,2,2]],[[0]], [[-1,None,-2]]],
721:[[[['John','a@x.io','b@x.io'],['John','b@x.io','c@x.io'],['John','z@x.io'],['Mary','m@x.io']] ],[[['Alex','a@x.io','a@x.io']]],[[['Alex','a@x.io'],['Alex','b@x.io']]]],
131:[['aab'],['a'],['abba'],['aaa']],51:[[1],[2],[4],[5]],
130:[[[list('XXXX'),list('XOOX'),list('XXOX'),list('XOXX')]]],
}
EDGE[721].append([[['A'*30,'a'*25+'@x.io']]])
# Canonical argument nesting: the board is the one positional argument.
EDGE[130]=[[[list('XXXX'),list('XOOX'),list('XXOX'),list('XOXX')]],[[['O']]],[[list('OXO'),list('XOX'),list('OXO')]]]

def pressure(pid):
 if pid==37:
  board=list(map(list,SUDOKU_HARD));answer=oracle(37,[board]);return [([board],answer),([answer],answer)]
 if pid==49:return [([['a'*100]*10000],[['a'*100]*10000])]
 if pid==249:return [([['a'*50]*100+['z'*50]*100],[['a'*50]*100+['z'*50]*100])]
 if pid==68:
  w='a'*20;line=w+' '*7+w+' '*7+w+' '*6+w
  return [([[w]*300,100],[line]*74+[' '.join([w]*4)+' '*17]),([['a']*300,1],['a']*300)]
 if pid==257:return [([[v for i in range(100) for v in ((None,-100) if i else (-100,))]],['->'.join(['-100']*100)])]
 if pid==721:
  accounts=[['A'*30,'shared@x.io']+[f'e{i}_{j}@x.io' for j in range(8)] for i in range(1000)]
  return [([accounts],[['A'*30]+sorted({'shared@x.io'}|{f'e{i}_{j}@x.io' for i in range(1000) for j in range(8)})])]
 if pid==131:return [(['a'*16],oracle(pid,['a'*16]))]
 if pid==51:return [([9],oracle(pid,[9]))]
 if pid==130:return [([[[ 'O']*200 for _ in range(200)]],[['O']*200 for _ in range(200)]),([[[ 'X']*200]+[['X']+['O']*198+['X'] for _ in range(198)]+[['X']*200]],[['X']*200 for _ in range(200)])]

META={
37:('solveSudoku','唯一解数独','Sudoku Solver','把9乘9棋盘中的点号填成1–9，使每行、每列、每个3乘3宫都恰含1–9，保留所有已给数字。题目保证唯一解，输出完整棋盘。','Fill dots in a 9 by 9 grid with digits 1–9 so each row, column and 3 by 3 box contains each digit exactly once, preserving every clue. The puzzle has exactly one solution; output the completed board.'),
49:('groupAnagrams','字母异位词分组','Group Anagrams','将字母出现次数完全相同的字符串归为同一组。重复输入字符串必须保留其出现次数，空串也要分组。','Group words with identical letter multiplicities. Preserve every occurrence of duplicate input strings; empty strings form a group.'),
249:('groupStrings','移位字符串分组','Group Shifted Strings','一次移位把每个字母都向后移动相同步数，z循环为a。把可以通过这种移位互相转换的字符串分组，保留重复字符串。','A shift moves every letter forward by the same amount modulo 26. Group strings convertible by such shifts, preserving duplicate occurrences.'),
68:('fullJustify','文本左右对齐','Text Justification','从左到右贪心装入尽可能多的完整单词。非最后行把空格尽量均匀分给单词间隙，余数优先左侧。最后行及只有一个词的行左对齐，词间单空格，右侧补空格。每行长度必须为maxWidth。','Greedily fit as many complete words as possible per line. Except on the last line, distribute spaces evenly, assigning extra spaces to earlier gaps. Last lines and single-word lines are left aligned, with single internal spaces and right padding. Every line has length maxWidth.'),
257:('binaryTreePaths','二叉树全部路径','Binary Tree Paths','返回每条从根到叶的路径，以->连接节点十进制值。不同叶子的路径即使字符串相同也各保留一次。','Return each root-to-leaf path as decimal values joined by ->. Paths reaching different leaves retain separate occurrences even if their strings coincide.'),
721:('accountsMerge','账号合并','Accounts Merge','每个账号第一项是姓名，其余为邮箱。共享任一邮箱的账号属于同一人，传递合并；同名不一定同一人。每个输出组为姓名后跟去重并按字典序排序的全部邮箱。保证同一人的姓名一致。','An account contains a name followed by emails. Accounts sharing any email belong to one person, including transitively connected accounts; a shared name alone does not imply identity. Output each name followed by all distinct emails in lexicographic order. A person has a consistent name.'),
131:('partition','回文分割全集','Palindrome Partitioning','返回把s切成若干非空回文子串的所有分割。每组子串按原字符串顺序拼接必须等于s。','Return all partitions of s into nonempty palindromic substrings. Within each partition, concatenating the substrings in order must reproduce s.'),
51:('solveNQueens','N皇后全部棋盘','N Queens','在n乘n棋盘放置n个皇后，使任意两皇后不同行、同列或同对角线，返回全部不同棋盘。每行字符串用Q表示皇后、点号表示空格；保持棋盘从顶至底行次序。','Return every distinct arrangement of n queens on an n by n board with no shared row, column or diagonal. Each row uses Q for a queen and . for an empty square, preserving top-to-bottom row order.'),
130:('solve','被围绕区域','Surrounded Regions','将没有经上下左右的O路径连接到边界的全部O改为X，其余格子不变，输出修改后的字符矩阵。','Replace every O component not connected to the boundary through orthogonal O cells with X. Leave all other cells unchanged and output the modified character matrix.')}
BOUNDS={37:('棋盘恰为9行9列，每格为1–9或点号，保证唯一解。','Exactly 9 rows of 9 cells, each a digit 1–9 or a dot; exactly one solution is guaranteed.'),49:('1≤字符串数≤10000，每串长度0–100，只有小写英文字母。','1–10000 strings, each length 0–100, lowercase English letters.'),249:('1≤字符串数≤200，每串长度1–50，只有小写英文字母。','1–200 strings, each length 1–50, lowercase English letters.'),68:('1–300个词，每词长1–20且不超过maxWidth，仅含无空白的英文字符和符号；1≤maxWidth≤100。','1–300 words of length 1–20, no longer than maxWidth, containing English letters and symbols without whitespace; 1≤maxWidth≤100.'),257:('树含1–100个节点，值为-100到100的整数。使用非空父节点队列的层序数组，空孩子写null，不保留末尾null。','Tree has 1–100 nodes with integer values -100..100. Use queue-based level order with null children only for non-null parents; omit trailing nulls.'),721:('1–1000个账号，每账号2–10项，每项长1–30；姓名仅英文字母，其余项为合法邮箱。','1–1000 accounts, each with 2–10 entries of length 1–30; names contain English letters, other entries are valid emails.'),131:('1≤s长度≤16，仅小写英文字母。','s has length 1–16 and contains lowercase English letters.'),51:('1≤n≤9。','1≤n≤9.'),130:('矩阵行数和列数各1–200，所有元素都是单字符X或O。','Matrix dimensions are each 1–200; every entry is the one-character string X or O.')}
MUTATIONS={37:[('不填入空格','result=args[0]'),('忽略原题给定数字',"result=[[str(int(v)%9+1) for v in row] for row in result]")],49:[('丢失重复词',"result=[list(set(row)) for row in result]"),('按长度分组',"d={}\nfor w in args[0]:d.setdefault(len(w),[]).append(w)\nresult=list(d.values())")],249:[('不处理字母循环',"d={}\nfor w in args[0]:d.setdefault(tuple(ord(c)-ord(w[0]) for c in w),[]).append(w)\nresult=list(d.values())"),('按长度分组',"d={}\nfor w in args[0]:d.setdefault(len(w),[]).append(w)\nresult=list(d.values())")],68:[('去掉行末填充空格','result=[s.rstrip() for s in result]'),('全部左对齐',"result=[s.strip().replace('  ',' ') for s in result]")],257:[('错误去重相同路径','result=list(set(result))'),('输出非叶路径',"result.append(str(args[0][0]))")],721:[('只按姓名合并',"d={}\nfor row in args[0]:d.setdefault(row[0],set()).update(row[1:])\nresult=[[name]+sorted(emails) for name,emails in d.items()]"),('不做传递合并','result=[[row[0]]+sorted(set(row[1:])) for row in args[0]]')],131:[('遗漏多段分割','result=[r for r in result if len(r)==1]'),('允许非回文整串','result=[[args[0]]]')],51:[('只返回一个棋盘','result=result[:1]'),('忽略对角冲突',"n=args[0];result=[['.'*i+'Q'+'.'*(n-i-1) for i in range(n)]]")],130:[('翻转全部O',"result=[['X']*len(row) for row in args[0]]"),('遗漏被包围区域','result=args[0]')]}

def make(pid):
 method,zh,en,dz,de=META[pid];bz,be=BOUNDS[pid]
 kind='json-string-array' if pid in (68,257) else 'json-string-rows';rng=random.Random(pid)
 edges=EDGE[pid]+[random_args(pid,rng) for _ in range(24-len(EDGE[pid]))]
 source='import sys,json\nfrom collections import deque\n'+inspect.getsource(sudoku_bitmask)+'\n'+inspect.getsource(fast)+'\nargs=json.load(sys.stdin)\n'+f'result=fast({pid},args)\n'
 spec=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh='输入一行JSON参数数组。'+bz+' 例如：'+json.dumps(edges[0],ensure_ascii=False),inputEn='One JSON positional-argument array. '+be+' Example: '+json.dumps(edges[0]),outputZh='输出一行完整JSON数组并换行；字符串的空串和空格必须保留。'+('行顺序严格。' if pid in (68,130,37) else '外层顺序不限；重复项按题意保留。')+('组内字符串顺序不限。' if pid in (49,249) else '组内顺序严格（账号邮箱必须排序）。' if pid==721 else '棋盘行/分割子串顺序严格。' if pid in (51,131) else ''),outputEn='Print one complete JSON array and a newline, preserving empty strings and spaces. '+('Keep row order.' if pid in (68,130,37) else 'Outer order is arbitrary; preserve required multiplicities. ')+('Group member order is arbitrary.' if pid in (49,249) else 'Keep inner row order; account emails must be sorted.' if pid==721 else 'Keep each board or partition in order.' if pid in (51,131) else ''),difficulty='困难' if pid in (68,51,37) else '简单' if pid==257 else '中等',resultKind=kind,stringStructureId=pid,outputLimit={49:2048,249:64,68:64,257:64,721:512,131:2048,51:64,130:256,37:64}[pid],edges=edges,pressure=pressure(pid),random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:json.dumps(a,separators=(',',':'))+'\n',parse='args=json.load(sys.stdin)',mutants=[dict(name=name,source=source+body+"\nprint(json.dumps(result,separators=(',',':')))\n") for name,body in MUTATIONS[pid]])
 if pid==257:spec['treeArgs']=[0]
 if pid in (130,37):spec['resultAdapter']='arg0'
 return spec
PROBLEMS={pid:make(pid) for pid in IDS}
