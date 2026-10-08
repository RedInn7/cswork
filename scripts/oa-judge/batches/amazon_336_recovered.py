#!/usr/bin/env python3
"""Return Records sign-in state machine recovered from the original API table image."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-amazon-336';BATCH='amazon-336-recovered';SEED=20261121
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='fastprep/Amazon/amazon-return-records.md'
RAW_SHA='b1a18ca6d41ebccc4d78b1c8b40710539f94af3125352c3847442335e615db21'
BLOB='4c318f88939f009c67d0f3f74b26e0213afc364c'
HASH='e9464e5345d2c4db1b3bea6d27bd11d253621a8e1ac780512671efdd4d55fa5a'
IMAGE='content/oa-judge/source-images/amazon-336-original.jpg'
IMAGE_SHA='29d0ce46a8c18c2a3eb58b12fb8e3565d199490620447c416005ac3b2a09ae95'
IMAGE_URL='https://www.fastprep.io/api/problem-source-images/amazon-return-records/0'
REG_OK,REG_DUP='Registered Successfully','Username already exists'
IN_OK,IN_BAD='Logged In Successfully','Login Unsuccessful'
OUT_OK,OUT_BAD='Logged Out Successfully','Logout Unsuccessful'
REFERENCE=r'''#include <cstdio>
#include <string>
#include <unordered_map>
using namespace std;
struct Account{string password;bool active=false;};
int main(){int n;if(scanf("%d",&n)!=1)return 0;unordered_map<string,Account> users;users.reserve(size_t(n)*2+1);
char op[16],name[16],pass[16];string out;out.reserve(size_t(n)*24);
for(int i=0;i<n;i++){scanf("%15s %15s",op,name);
if(op[0]=='r'){scanf("%15s",pass);auto r=users.try_emplace(name);if(r.second){r.first->second.password=pass;out+="Registered Successfully\n";}else out+="Username already exists\n";}
else if(op[3]=='i'){scanf("%15s",pass);auto it=users.find(name);if(it!=users.end()&&!it->second.active&&it->second.password==pass){it->second.active=true;out+="Logged In Successfully\n";}else out+="Login Unsuccessful\n";}
else{auto it=users.find(name);if(it!=users.end()&&it->second.active){it->second.active=false;out+="Logged Out Successfully\n";}else out+="Logout Unsuccessful\n";}}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误重复注册覆盖旧密码','language':'cpp','code':REFERENCE.replace('if(r.second){r.first->second.password=pass;out+="Registered Successfully\\n";}else out+="Username already exists\\n";','if(r.second){r.first->second.password=pass;out+="Registered Successfully\\n";}else{r.first->second.password=pass;out+="Username already exists\\n";}')},
 {'name':'错误允许已登录用户再次登录','language':'cpp','code':REFERENCE.replace('&&!it->second.active&&','&&')},
 {'name':'错误注册后自动登录','language':'cpp','code':REFERENCE.replace('r.first->second.password=pass;out+="Registered','r.first->second.password=pass;r.first->second.active=true;out+="Registered')},
 {'name':'错误已登录时错误密码登录会结束原会话','language':'cpp','code':REFERENCE.replace('out+="Logged In Successfully\\n";}else out+="Login Unsuccessful\\n";','out+="Logged In Successfully\\n";}else{if(it!=users.end())it->second.active=false;out+="Login Unsuccessful\\n";}')},
 {'name':'错误用户名不区分大小写','language':'cpp','code':REFERENCE.replace('scanf("%15s %15s",op,name);','scanf("%15s %15s",op,name);for(char *p=name;*p;p++)if(*p>=65&&*p<=90)*p+=32;')},
]
for m in MUTANTS:assert m['code']!=REFERENCE,m['name']
EDITORIAL='''## 原始规则与来源恢复

固定上游 fastprep/Amazon/amazon-return-records.md 的核心API表是一张不可访问的本机图片，只留下注意事项、约束和两组样例。本站从原FastPrep页面公开的Problem Source图恢复了这张表，图片保存在content/oa-judge/source-images/amazon-336-original.jpg，哈希绑定在来源证据。这张图不是固定Git快照里的资产，只作为同一原页面的补充来源；两人分别看图确认了表格内容。没有执行上游任何代码。

表格给出三种请求和六种返回值：register成功返回Registered Successfully，用户已存在返回Username already exists；login成功返回Logged In Successfully，否则Login Unsuccessful；logout成功返回Logged Out Successfully，给定用户当前未登录返回Logout Unsuccessful。图中注意事项：初始没有用户；已登录用户再次登录失败，原登录保持有效；按输入顺序执行；用户名和密码区分大小写。

## 两处原文勘误

原文字例2的第四个输出写成Login Unsuccessfully，与原图表格中的Login Unsuccessful不一致。本站统一使用表格文案，并在题面中明确说明这个更正，不在同一题里混用两种拼写。原例2解释写“The user David is logged in”，实际输入是logout david；本站保持输入david不变，只在解释里改成david。

## 输入适配

第一行n，随后n行各一个请求：register username password、login username password或logout username，字段间一个空格。输出n行，第i行为第i个请求的返回值。完整原范围保留：1≤n≤100000，用户名和密码都是长度1..10的ASCII字母数字串。六个返回值的首词两两可区分（Logged后接In或Out），评测按空白分词比对与逐行比对等价。

## 状态与规则推导

每个用户只需要两项状态：注册时的密码，以及当前是否登录。

- register：用户名不存在才创建，密码记下，初始未登录。注册不自动登录。用户名已存在时返回Username already exists，不覆盖密码，也不改变其登录状态。
- login：用户存在、密码完全一致、当前未登录，三者同时成立才成功并标记登录。任一不满足都失败，且不改变任何状态；特别是已登录用户无论密码对错再次登录都失败，原会话继续有效，之后仍能正常退出。
- logout：用户存在且当前已登录才成功并标记未登录；用户不存在或未登录都返回Logout Unsuccessful。

不同用户的状态互不影响。大小写不同的用户名是不同用户，大小写不同的密码不匹配。

## 正确性

用哈希表保存用户名到(密码,是否登录)。每个请求只读写该用户名对应的一项，按上面三条规则判定，与表格及注意事项逐条对应。失败分支一律不写状态，所以失败请求不改变任何用户。归纳到第i个请求：前i−1个请求处理后表中状态等于网站真实状态，则第i个请求的返回值和新状态都正确。

## 复杂度

每个请求期望O(L)，L≤10为字段长度，总计O(nL)时间、O(用户数·L)空间。输出可达约240万字节，参考解先拼接再一次写出。

## 独立验证

oracle用Python字典与集合分别保存密码和已登录用户，按规则直接模拟，不复用参考解。小域另写历史回放判定：用户是否存在看此前是否有该用户的register，密码取最早一次register，是否在线看此前该用户最近一次成功的login/logout是哪个；用两个大小写不同的用户名和两个大小写不同的密码，穷举长度1..4的全部请求序列，并逐个真实运行参考程序。正式用例覆盖原例、重复注册后旧密码仍有效、已登录时错/对密码再次登录都失败且随后能退出、未知用户登录与退出、大小写、跨用户隔离，以及十万请求的高基数用户、最长字段、高冲突随机、全失败退出等。五个正常退出的错误程序（覆盖密码、允许重复登录、注册自动登录、失败登录踢下线、用户名忽略大小写）在全部正式用例上执行并各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
ALNUM=set(string.ascii_letters+string.digits)
def valid(s):return 1<=len(s)<=10 and set(s)<=ALNUM
def encode(reqs):
 assert 1<=len(reqs)<=100000
 for r in reqs:
  assert r[0] in('register','login','logout') and len(r)==(2 if r[0]=='logout' else 3) and all(valid(x) for x in r[1:])
 return str(len(reqs))+'\n'+''.join(' '.join(r)+'\n' for r in reqs)
def simulate(reqs):
 passwords={};online=set();out=[]
 for r in reqs:
  if r[0]=='register':
   if r[1] in passwords:out.append(REG_DUP)
   else:passwords[r[1]]=r[2];out.append(REG_OK)
  elif r[0]=='login':
   if passwords.get(r[1])==r[2] and r[1] not in online:online.add(r[1]);out.append(IN_OK)
   else:out.append(IN_BAD)
  else:
   if r[1] in online:online.remove(r[1]);out.append(OUT_OK)
   else:out.append(OUT_BAD)
 return out
def replay(reqs):
 """Stateless history replay: every answer re-derived from earlier requests and earlier answers."""
 out=[]
 for i,r in enumerate(reqs):
  regs=[q for q in reqs[:i] if q[0]=='register' and q[1]==r[1]]
  events=[out[j] for j,q in enumerate(reqs[:i]) if q[1]==r[1] and out[j] in(IN_OK,OUT_OK)]
  online=bool(events) and events[-1]==IN_OK
  if r[0]=='register':out.append(REG_DUP if regs else REG_OK)
  elif r[0]=='login':out.append(IN_OK if regs and regs[0][2]==r[2] and not online else IN_BAD)
  else:out.append(OUT_OK if online else OUT_BAD)
 return out
def expect(reqs):return ''.join(x+'\n' for x in simulate(reqs))
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=10);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def word(rng,lo=1,hi=10):return ''.join(rng.choice(string.ascii_letters+string.digits) for _ in range(rng.randint(lo,hi)))
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert sha((ROOT/IMAGE).read_bytes())==IMAGE_SHA
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 R=lambda u,p:('register',u,p);I=lambda u,p:('login',u,p);O=lambda u:('logout',u)
 ex1=[R('user05','qwerty'),I('user05','qwerty'),O('user05')]
 ex2=[R('david','david123'),R('adam','1Adam1'),I('david','david123'),I('adam','1adam1'),O('david')]
 assert simulate(ex1)==[REG_OK,IN_OK,OUT_OK]
 assert simulate(ex2)==[REG_OK,REG_OK,IN_OK,IN_BAD,OUT_OK]  # raw text says "Login Unsuccessfully"; table image says Login Unsuccessful
 ex3=[R('Bob','pw1'),R('Bob','pw2'),I('Bob','pw2'),I('Bob','pw1'),I('Bob','pw1'),O('bob'),O('Bob'),O('Bob')]
 small=[ex1,ex2,ex3,
  [R('a','p'),R('a','q'),I('a','q'),I('a','p'),O('a')],
  [R('u','x'),I('u','x'),I('u','wrong'),I('u','x'),O('u'),O('u')],
  [I('ghost','pw'),O('ghost'),R('ghost','pw'),O('ghost'),I('ghost','pw')],
  [R('Ab','Cd'),I('aB','Cd'),I('Ab','cD'),I('Ab','Cd'),O('ab'),O('Ab')],
  [R('a','1'),R('b','1'),I('a','1'),O('b'),I('b','1'),O('a'),O('a'),O('b')],
  [R('z','z'),O('z'),I('z','z'),O('z'),I('z','z'),O('z')],
  [O('x')],[I('x','y')],[R('x','y')],
  [R('a'*10,'Z'*10),I('a'*10,'Z'*9+'z'),I('a'*10,'Z'*10),R('a'*10,'b'),O('a'*10)],
  [R('0','0'),R('00','0'),I('0','00'),I('00','0'),I('0','0'),O('00'),O('0')]]
 rng=random.Random(SEED);keys={encode(a) for a in small}
 assert len(keys)==len(small)
 while len(small)<180:
  users=[word(rng,1,3) for _ in range(rng.randint(1,4))];pws=[word(rng,1,2) for _ in range(rng.randint(1,3))]
  reqs=[]
  for _ in range(rng.randint(1,24)):
   k=rng.randrange(3);u=rng.choice(users)
   reqs.append(R(u,rng.choice(pws)) if k==0 else I(u,rng.choice(pws)) if k==1 else O(u))
  key=encode(reqs)
  if key not in keys:keys.add(key);small.append(reqs)
 for a in small:assert replay(a)==simulate(a)
 oracles=[{'input':encode(a),'expectedOutput':expect(a)} for a in small]
 cases=[];large=[]
 def add(name,reqs,hidden=True,check=None):
  e=expect(reqs)
  if check:check(simulate(reqs))
  cases.append({'name':name,'input':encode(reqs),'expectedOutput':e,'hidden':hidden,'weight':1})
 names=['原样例1','原样例2（文案按原图更正）','本站补充：重复注册与重复登录','重复注册旧密码有效','已登录时错对密码都失败','未知用户登录与退出','大小写区分','跨用户隔离','反复登录退出','单个未知退出','单个未知登录','单个注册','最长字段','数字用户名']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+14):add(f'小域随机{i-len(names)+1}',small[i])
 N=100000
 def users(count,length):
  s=set()
  while len(s)<count:s.add(''.join(rng.choice(string.ascii_letters+string.digits) for _ in range(length)))
  return sorted(s,key=lambda _:rng.random())
 U=users(N,10)
 add('十万个不同最长用户名注册',[R(u,'P'*10) for u in U],check=lambda o:o.count(REG_OK)==N)
 V=U[:N//3]
 add('高基数注册登录退出循环',[R(u,u[::-1]) for u in V]+[I(u,u[::-1]) for u in V]+[O(u) for u in V]+[O(V[0])],check=lambda o:o.count(OUT_OK)==len(V) and o[-1]==OUT_BAD)
 add('重复注册风暴不覆盖密码',[R('Same','orig')]+[R('Same',word(rng)) for _ in range(N-3)]+[I('Same','orig'),O('Same')],check=lambda o:o[-2:]==[IN_OK,OUT_OK])
 add('已登录反复登录不掉线',[R('Hot','pw'),I('Hot','pw')]+[I('Hot','pw' if i%2 else 'bad') for i in range(N-3)]+[O('Hot')],check=lambda o:o[-1]==OUT_OK and o.count(IN_OK)==1)
 add('全部未知用户退出',[O(u) for u in U],check=lambda o:set(o)=={OUT_BAD})
 add('全部未知用户登录',[I(u,'x') for u in U],check=lambda o:set(o)=={IN_BAD})
 W=users(N//4,10)
 def caseset():
  reqs=[]
  for u in W[:N//8]:
   v=u.swapcase()
   reqs+= [R(u,'Pw'),I(v,'Pw'),I(u,'pW')] if v!=u else [R(u,'Pw'),I(u,'pw'),I(u,'PW')]
  return reqs[:N]
 add('大小写变体高基数',caseset(),check=lambda o:o.count(IN_OK)==0)
 X=users(20000,10)
 add('最长密码末位不同',[R(u,'Aa'*5) for u in X]+[I(u,'Aa'*4+'AA') for u in X]+[I(u,'Aa'*5) for u in X]+[O(u) for u in X]+[O(u) for u in X],check=lambda o:o.count(IN_OK)==20000 and o.count(OUT_OK)==20000)
 for label,pool,pwpool in [('高冲突随机五用户',users(5,1)+['Q'],['a','A']),('中等基数随机',users(1000,rng.randint(4,10)),[word(rng) for _ in range(3)]),('高基数随机',users(30000,10),[word(rng,10,10) for _ in range(4)])]:
  reqs=[]
  for _ in range(N):
   k=rng.randrange(3);u=rng.choice(pool)
   reqs.append(R(u,rng.choice(pwpool)) if k==0 else I(u,rng.choice(pwpool)) if k==1 else O(u))
  add('十万请求'+label,reqs)
 print(f'Amazon336 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='amazon336-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  alphabet=[R(u,p) for u in('a','A') for p in('x','X')]+[I(u,p) for u in('a','A') for p in('x','X')]+[O('a'),O('A')]
  exhaustive=0
  for n in range(1,5):
   for seq in product(alphabet,repeat=n):
    seq=list(seq);e=replay(seq);assert e==simulate(seq)
    assert execute(binary,encode(seq))[0]==''.join(x+'\n' for x in e);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if case['name'].startswith(('十万','高基数','重复注册风暴','已登录反复','全部未知','大小写变体','最长密码')):large.append({'name':case['name'],'n':int(case['input'].split('\n',1)[0]),'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput']:rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Amazon OA #336：Return Records','difficulty':'中等','tags':['哈希表','模拟','状态机'],
 'description':'实现一个模拟网站的注册、登录和退出接口。按顺序处理n个请求，输出每个请求的返回值。\n\nregister username password：用户名未注册时创建用户并返回Registered Successfully（不自动登录）；已存在返回Username already exists，原密码和登录状态不变。\nlogin username password：用户存在、密码一致且当前未登录时登录成功，返回Logged In Successfully；否则返回Login Unsuccessful。已登录的用户再次登录一律失败，原登录保持有效。\nlogout username：该用户当前已登录时退出并返回Logged Out Successfully；用户不存在或未登录返回Logout Unsuccessful。\n\n初始没有任何用户。用户名和密码区分大小写，各用户状态互不影响，失败的请求不改变任何状态。核心API表在上游快照中是缺失图片，本站依据原页面公开的原图恢复。',
 'input':'第一行n。随后n行，每行一个请求：register username password、login username password或logout username，字段间一个空格。1≤n≤100000；username和password均为长度1..10的字母数字串（0-9、a-z、A-Z）。标准输入是本站对字符串数组参数的适配。',
 'output':'输出n行，第i行是第i个请求的返回值，只可能是Registered Successfully、Username already exists、Logged In Successfully、Login Unsuccessful、Logged Out Successfully、Logout Unsuccessful之一。',
 'explanation':'原样例1、原样例2保留输入。原样例2第四个输出在上游文字中写作Login Unsuccessfully，与原图表格Login Unsuccessful不一致，本站按原图统一为Login Unsuccessful；其解释中的David对应输入david。第三个样例为本站补充：重复注册不覆盖密码，已登录时再次登录失败，logout bob因大小写不同而失败。',
 'hints':['每个用户只需记录密码和是否在线两项状态。','失败的请求不要修改任何状态。','已在线的用户再次登录，无论密码对错都失败。'],
 'timeLimit':2,'memoryLimit':262144,'outputLimit':4096,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'按用户维护密码与在线状态的模拟','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,
  'sourceImages':[{'path':IMAGE,'sha256':IMAGE_SHA,'url':IMAGE_URL}],
  'imageProvenance':'Publicly readable Problem Source image linked from the original FastPrep page img src, viewed in full by two reviewers. Not an immutable asset of the fixed upstream commit. Supplies the complete API return table, notes, example and constraints.',
  'rangeDisclosure':'Full original bounds preserved: n1..100000, username/password alphanumeric length1..10. Stdin adaptation of string array; one request per line.',
  'corrections':['Raw example2 fourth output "Login Unsuccessfully" corrected to table string "Login Unsuccessful"; disclosed in statement.','Raw example2 explanation "David" refers to input "david"; input unchanged.','Third public example is authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'从原页面公开原图恢复完整API返回表与注意事项，六种文案精确；原例2拼写按原图更正并明示；全范围哈希表模拟，独立字典模拟与历史回放穷举核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent Python dict/set simulation; stateless history replay (first register password, last successful login/logout event) cross-checked on every oracle input and exhaustive small domain.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':4,'usernames':['a','A'],'passwords':['x','X']},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Amazon336 frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
