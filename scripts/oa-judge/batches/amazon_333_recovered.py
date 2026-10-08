#!/usr/bin/env python3
"""Sign In Pages register/login/logout state machine; notes and sample from the 333 original image,
response table cross-checked against the same-narrative Amazon336 original image."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-amazon-333';BATCH='amazon-333-recovered';SEED=20261203
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
MDX='web/content/docs/companies/amazon.mdx'
MDX_SHA='07d33d58794347890f76b4199a9805d5fac529f0702dea6884e6fce484b69985'
MDX_BLOB='70650fad830ad60944ae8036fb4f134d9afc3fab'
PATH='fastprep/Amazon/amazon-register-login-logout.md'
RAW_SHA='d0d861b11d6b59d5a2050f332590fa286bfed3b1ca33c86aee901406e611addc'
BLOB='a27268a422b2db62117c37aea7d00298491f7b3f'
P336='fastprep/Amazon/amazon-return-records.md'
P336_SHA='b1a18ca6d41ebccc4d78b1c8b40710539f94af3125352c3847442335e615db21'
P336_BLOB='4c318f88939f009c67d0f3f74b26e0213afc364c'
HASH='4605725df15729ce03a22eb988ad9f7e0bc634a5570f19ee1e1926f47df656e3'
IMAGE='content/oa-judge/source-images/amazon-333-original.jpg'
IMAGE_SHA='0bf6cb84b18b3707eca7670b51e161c2588c5b4036c01a9ec0be7e81f14df64c'
IMAGE_URL='https://www.fastprep.io/api/problem-source-images/amazon-register-login-logout/0'
IMAGE336='content/oa-judge/source-images/amazon-336-original.jpg'
IMAGE336_SHA='29d0ce46a8c18c2a3eb58b12fb8e3565d199490620447c416005ac3b2a09ae95'
IMAGE336_URL='https://www.fastprep.io/api/problem-source-images/amazon-return-records/0'
MAXN=1000000
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
EDITORIAL='''## 题意

按输入顺序处理n个请求：register username password、login username password、logout username，输出每个请求的返回值。初始没有用户；已登录的用户再次登录失败，原登录保持有效；用户名和密码区分大小写。

## 每种请求的规则

每个用户只需要两项状态：注册时的密码，以及当前是否登录。

- register：用户名不存在才创建，记下密码，初始未登录，返回Registered Successfully。注册不会自动登录。用户名已存在时返回Username already exists，不覆盖密码，也不改变登录状态。
- login：用户存在、密码完全一致、当前未登录，三者同时成立才成功，标记为登录并返回Logged In Successfully。任一条件不满足都返回Login Unsuccessful，且不改变任何状态；已登录用户无论密码对错再次登录都失败，原会话继续有效，之后仍能正常退出。
- logout：用户存在且当前已登录才成功，标记为未登录并返回Logged Out Successfully；用户不存在或未登录都返回Logout Unsuccessful。

不同用户的状态互不影响。大小写不同的用户名是不同用户，大小写不同的密码不匹配。

## 正确性

用哈希表保存“用户名→(密码,是否登录)”。每个请求只读写该用户名对应的一项，并严格按上面三条规则判定。失败分支一律不写状态，所以失败请求不会改变任何用户。对请求序号归纳：若前i−1个请求处理后表中状态与真实状态一致，则第i个请求的返回值与新状态也正确。

## 复杂度

每个请求期望O(L)，L≤10为字段长度，总计O(nL)时间、O(用户数·L)空间。n可达10^6，输出约两千多万字节，参考解先拼接再一次写出。

## 独立验证

oracle用Python字典与集合分别保存密码和已登录用户，直接模拟，不复用参考解。另写历史回放判定：用户是否存在看此前是否有该用户的register，密码取最早一次register，是否在线看此前该用户最近一次成功的login/logout；对每个oracle输入交叉比对。小域用两个大小写不同的用户名和两个大小写不同的密码，穷举长度1..4的全部请求序列，并逐个真实运行参考程序。正式用例覆盖原样例、重复注册后旧密码仍有效、已登录时错/对密码再次登录都失败且随后能退出、未知用户登录与退出、大小写、跨用户隔离，以及十万到百万请求的高基数用户、最长字段、高冲突随机等。五个正常退出的错误程序（覆盖密码、允许重复登录、注册自动登录、失败登录踢下线、用户名忽略大小写）在正式用例上各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
ALNUM=set(string.ascii_letters+string.digits)
def valid(s):return 1<=len(s)<=10 and set(s)<=ALNUM
def encode(reqs):
 assert 1<=len(reqs)<=MAXN
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
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def word(rng,lo=1,hi=10):return ''.join(rng.choice(string.ascii_letters+string.digits) for _ in range(rng.randint(lo,hi)))
def main():
 started=time.perf_counter()
 raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert b'amazonSignInPages.png' in raw and b'_(none)_' in raw
 mdx=subprocess.check_output(['git','show',f'{COMMIT}:{MDX}'],cwd=ROOT);assert sha(mdx)==MDX_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=mdx).decode().strip()==MDX_BLOB and '## 333. Sign In Pages' in mdx.decode()
 r336=subprocess.check_output(['git','show',f'{COMMIT}:{P336}'],cwd=ROOT);assert sha(r336)==P336_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=r336).decode().strip()==P336_BLOB
 assert sha((ROOT/IMAGE).read_bytes())==IMAGE_SHA and sha((ROOT/IMAGE336).read_bytes())==IMAGE336_SHA
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 R=lambda u,p:('register',u,p);I=lambda u,p:('login',u,p);O=lambda u:('logout',u)
 ex1=[R('david','david123'),R('adam','1Adam1'),I('david','david123'),I('adam','1adam1'),O('david')]
 assert simulate(ex1)==[REG_OK,REG_OK,IN_OK,IN_BAD,OUT_OK]  # 333 image sample output, spelled exactly as in the image
 ex2=[R('Bob','pw1'),R('Bob','pw2'),I('Bob','pw2'),I('Bob','pw1'),I('Bob','pw1'),O('bob'),O('Bob'),O('Bob')]
 ex3=[I('ghost','pw'),O('ghost'),R('ghost','pw'),O('ghost'),I('ghost','pw')]
 small=[ex1,ex2,ex3,
  [R('a','p'),R('a','q'),I('a','q'),I('a','p'),O('a')],
  [R('u','x'),I('u','x'),I('u','wrong'),I('u','x'),O('u'),O('u')],
  [R('user05','qwerty'),I('user05','qwerty'),O('user05')],
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
 names=['原样例','重复注册与重复登录','未知用户与注册后未登录','重复注册旧密码有效','已登录时错对密码都失败','注册登录退出完整流程','大小写区分','跨用户隔离','反复登录退出','单个未知退出','单个未知登录','单个注册','最长字段','数字用户名']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+14):add(f'小域随机{i-len(names)+1}',small[i])
 def users(count,length):
  s=set()
  while len(s)<count:s.add(''.join(rng.choice(string.ascii_letters+string.digits) for _ in range(length)))
  return sorted(s,key=lambda _:rng.random())
 U=users(MAXN,10)
 add('百万个不同最长用户名注册',[R(u,'P'*10) for u in U],check=lambda o:o.count(REG_OK)==MAXN)
 N=100000;V=U[:N//3]
 add('高基数注册登录退出循环',[R(u,u[::-1]) for u in V]+[I(u,u[::-1]) for u in V]+[O(u) for u in V]+[O(V[0])],check=lambda o:o.count(OUT_OK)==len(V) and o[-1]==OUT_BAD)
 add('重复注册风暴不覆盖密码',[R('Same','orig')]+[R('Same',word(rng)) for _ in range(N-3)]+[I('Same','orig'),O('Same')],check=lambda o:o[-2:]==[IN_OK,OUT_OK])
 add('已登录反复登录不掉线',[R('Hot','pw'),I('Hot','pw')]+[I('Hot','pw' if i%2 else 'bad') for i in range(N-3)]+[O('Hot')],check=lambda o:o[-1]==OUT_OK and o.count(IN_OK)==1)
 add('全部未知用户退出',[O(u) for u in U[:N]],check=lambda o:set(o)=={OUT_BAD})
 W=U[N:N+N//8]
 def caseset():
  reqs=[]
  for u in W:
   v=u.swapcase()
   reqs+= [R(u,'Pw'),I(v,'Pw'),I(u,'pW')] if v!=u else [R(u,'Pw'),I(u,'pw'),I(u,'PW')]
  return reqs
 add('大小写变体高基数',caseset(),check=lambda o:o.count(IN_OK)==0)
 X=U[2*N:2*N+20000]
 add('最长密码末位不同',[R(u,'Aa'*5) for u in X]+[I(u,'Aa'*4+'AA') for u in X]+[I(u,'Aa'*5) for u in X]+[O(u) for u in X]+[O(u) for u in X],check=lambda o:o.count(IN_OK)==20000 and o.count(OUT_OK)==20000)
 for label,count,pool,pwpool in [('十万请求高冲突随机五用户',N,users(5,1)+['Q'],['a','A']),('十五万请求高基数随机',150000,U[3*N:3*N+50000],[word(rng,10,10) for _ in range(4)])]:
  reqs=[]
  for _ in range(count):
   k=rng.randrange(3);u=rng.choice(pool)
   reqs.append(R(u,rng.choice(pwpool)) if k==0 else I(u,rng.choice(pwpool)) if k==1 else O(u))
  add(label,reqs)
 U=V=W=X=None
 assert len({c['input'] for c in cases})==len(cases)
 print(f'Amazon333 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='amazon333-native-') as tmp:
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
   n=int(case['input'].split('\n',1)[0])
   if n>=20000:large.append({'name':case['name'],'n':n,'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput']:rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Amazon OA #333：Sign In Pages','difficulty':'中等','tags':['哈希表','模拟','状态机'],
 'description':'实现三个登录相关页面的接口：Register、Login、Logout。按顺序处理n个请求，输出每个请求的返回值。\n\nregister username password：用户名未注册时创建用户并返回Registered Successfully（注册不会自动登录）；用户名已存在返回Username already exists，原密码和登录状态不变。\nlogin username password：用户存在、密码一致且当前未登录时登录成功，返回Logged In Successfully；否则返回Login Unsuccessful。已登录的用户再次登录一律失败，原登录保持有效。\nlogout username：该用户当前已登录时退出并返回Logged Out Successfully；用户不存在或未登录返回Logout Unsuccessful。\n\n初始没有任何用户。请求按输入顺序执行。用户名和密码区分大小写，各用户状态互不影响，失败的请求不改变任何状态。',
 'input':'第一行n。随后n行，每行一个请求：register username password、login username password或logout username，字段间一个空格。1≤n≤10^6；username和password均为长度1..10的字母数字串（0-9、a-z、A-Z）。',
 'output':'输出n行，第i行是第i个请求的返回值，只可能是Registered Successfully、Username already exists、Logged In Successfully、Login Unsuccessful、Logged Out Successfully、Logout Unsuccessful之一。',
 'explanation':'样例1：david和adam注册成功；david用正确密码登录成功；adam的密码1adam1与注册时的1Adam1大小写不同，登录失败；david已登录，退出成功。样例2：Bob重复注册失败且不覆盖密码，用pw2登录失败、pw1登录成功；已登录时再次登录失败；logout bob因大小写不同失败，随后Bob退出成功，再次退出失败。样例3：未注册用户登录、退出都失败；刚注册还未登录的用户退出失败。',
 'hints':['每个用户只需记录密码和是否在线两项状态。','失败的请求不要修改任何状态。','已在线的用户再次登录，无论密码对错都失败。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':32768,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 payload=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False);ncases=len(cases);total_case_bytes=sum(len(c['input'])+len(c['expectedOutput']) for c in cases);cases=None
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=payload,text=True,capture_output=True,check=True).stdout;payload=None
 assert len(normalized.encode())<128*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'按用户维护密码与在线状态的模拟','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],
  'sources':[{'path':MDX,'section':'## 333. Sign In Pages','gitBlobSha':MDX_BLOB,'rawSha256':MDX_SHA},{'path':PATH,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'role':'FastPrep page for this problem; core image is a missing local path, constraints are _(none)_'},{'path':P336,'gitBlobSha':P336_BLOB,'rawSha256':P336_SHA,'role':'same-narrative Amazon336 page (identical five notes and five-request sample); cross-source only'}],'upstreamCodeExecuted':False,
  'sourceImages':[{'path':IMAGE,'sha256':IMAGE_SHA,'url':IMAGE_URL,'role':'own Problem Source image: five notes, STDIN format (n then one request per line), five-request david/adam sample with output'},{'path':IMAGE336,'sha256':IMAGE336_SHA,'url':IMAGE336_URL,'role':'same-narrative Amazon336 Problem Source image: complete register/login/logout response table and alphanumeric 1..10 credential constraint'}],
  'ruleProvenance':{'fromOwnImage':['Initially no users registered.','Already logged-in user login request is unsuccessful; original login remains active.','Requests execute in input order.','Usernames and passwords are case-sensitive.','Responses Registered Successfully, Logged In Successfully, Login Unsuccessful, Logged Out Successfully appear verbatim in the sample output.'],'fromSameNarrative336Image':['Register failure response Username already exists.','Logout response Logout Unsuccessful when the given username is not logged in.','Credential alphabet [0-9a-zA-Z], length 1..10.'],'crossCheck':'The 333 image notes match the 336 image notes one-for-one and the 333 image sample is identical to the 336 raw text example 2 (with the correct Login Unsuccessful spelling). Followup review recorded in docs/oa-recovery/remaining-source-followups.json.'},
  'imageProvenance':'Both images are publicly readable Problem Source images linked from the original FastPrep pages (img src), not immutable assets of the fixed upstream commit. Each was viewed in full; the 333 image was re-checked line by line for this package.',
  'rangeDisclosure':'The 333 sources give no numeric bounds (FastPrep constraints are _(none)_; the 333 image has none). Credential format 1..10 alphanumeric is taken from the same-narrative 336 image. Under the full 32MiB input transport domain, 3728269 minimal logout requests would need 74565380 output bytes, above the 64MiB expected-output budget, so the request count is capped at n<=10^6 (longest register line 31 bytes -> about 31MB input, at most 24 bytes per response -> at most 24MB output).',
  'corrections':['No correction needed: the 333 image sample output already uses Login Unsuccessful. The 333 image sample explanation does not exist; public examples 2 and 3 are authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'本题原图给出注意事项、STDIN格式与样例，完整返回表与凭据格式取自同叙述336原图并逐条交叉核对；按用户指定范围政策把请求数上限定为10^6（原无界及容量反例记录在source evidence）；哈希表模拟与独立字典模拟、历史回放穷举核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':ncases-3,'referenceFormalCases':ncases,'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent Python dict/set simulation; stateless history replay (first register password, last successful login/logout event) cross-checked on every oracle input and exhaustive small domain.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':4,'usernames':['a','A'],'passwords':['x','X']},'largeBoundaries':large,'caseBytes':total_case_bytes,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Amazon333 frozen: {ncases} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
