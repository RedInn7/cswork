#!/usr/bin/env python3
"""Catalan modulo10000 over full nonnegative Java int, independent binomial difference oracle."""
from pathlib import Path
import hashlib,json,math,random,subprocess,sys,time

ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-commvault-1';BATCH='commvault-1-recovered';SEED=20261105
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCE='fastprep/Commvault/commvault-count-good-strings.md'
BLOB='18327db353e324e309497ade0f747b99c4eb66f2'
RAW_SHA='c95eb36bad091fcf53b6b6c11a042d36593c08d859197b51a8a98b8be3075d5d'
HASH='a65b7d6e091793add57c58517d08091991e9186d80d12eabf11d3f30e40edb91'
MAX=2147483647
REFERENCE='''import sys

def catalan_residue(n,p,a):
    q=p**a
    prefix=[1]
    for i in range(1,q+1):
        prefix.append(prefix[-1]*(i if i%p else 1)%q)
    def unit_factorial(k):
        result=1
        while k:
            result=result*pow(prefix[q],k//q,q)*prefix[k%q]%q
            k//=p
        return result
    def valuation(k):
        result=0
        while k:
            k//=p
            result+=k
        return result
    divisor=n+1
    removed=0
    while divisor%p==0:
        divisor//=p
        removed+=1
    exponent=valuation(2*n)-2*valuation(n)-removed
    if exponent>=a:
        return 0
    denominator=unit_factorial(n)**2*divisor%q
    return unit_factorial(2*n)*pow(denominator,-1,q)*pow(p,exponent,q)%q

def solve(raw):
    n=int(raw)
    a=catalan_residue(n,2,4)
    b=catalan_residue(n,5,4)
    return str(a+16*((b-a)*586%625))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
 {'name':'错误只保留模16余数而未正确CRT','code':REFERENCE.replace('return str(a+16*((b-a)*586%625))','return str(a)')},
 {'name':'错误假定n+1不能整除模数且返回零','code':REFERENCE.replace('n=int(raw)','n=int(raw)\n    if (n+1)%2==0 or (n+1)%5==0: return "0"')},
 {'name':'错误用32位有符号数容纳2n','code':REFERENCE.replace('n=int(raw)','n=int(raw)\n    if n>1073741823: return "0"')},
]
EDITORIAL='''## 固定原文与范围披露

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Commvault/commvault-count-good-strings.md定义：长度2N、恰N个A和N个B，每个前缀A数量不小于B数量，答案模10000。原例N=3答案5正确，五个合法串AAABBB、AABABB、AABBAB、ABAABB、ABABAB均保留。原解释说BABABA的前缀BA中B更多不准确，BA两种各一个；真正违例前缀是首字符B，本站明确纠正该解释，不改正确答案5。

原Constraints栏只有o_o，没有数值范围，不能声称它写了N≤某个人为小常数。不过原始starter完整为public int countGoodStrings(int N)，因此本站覆盖非负Java int的整个域0..2147483647：这是按原接口类型与N为计数推导的包络，不是从o_o恢复出的显式约束。N=0时按组合定义存在一个空串，输出1；这是明确公开的数学边界补全。负N不能表示字符串长度或字符数，不作为合法输入。2N可超过32位有符号数，计算时必须提升到64位或大整数。

## 思路

把A看作+1、B看作−1，合法串是从0出发、任意前缀非负并回到0的步行。由反射原理，答案为Catalan数C_N=binom(2N,N)/(N+1)。但10000不是素数，且N+1可能与10000不互质，绝不能直接在模10000下求其逆元。

分别计算模16=2^4、625=5^4。对质数p和q=p^4，记V(k)=Σ floor(k/p^j)，U(k)为k!去掉所有p因子后的单位部分模q。取t=v_p(N+1)，d=(N+1)/p^t，则C_N的p指数为e=V(2N)−2V(N)−t。e≥4时该模数下答案0，否则答案是U(2N)·inverse(U(N)^2·d)·p^e modq。所求逆元的分母与p互质，始终存在。

预计算P[r]=∏(1≤i≤r且p不整除i)i modq。所有不被p整除的因子按长度q分块；被p整除的因子除去一个p后递归对应floor(k/p)!。故U(k)=P[q]^(floor(k/q))·P[k modq]·U(floor(k/p)) modq，迭代到0即可，不能把阶乘本身巨大数构造出来。

得到a=C_N mod16和b=C_N mod625后，CRT给唯一0..9999答案a+16·(((b−a)·586) mod625)，因为16·586≡1(mod625)。输出普通整数，不要求补足四位前导零。

## 正确性证明

长度2N中A/B各N的串共有binom(2N,N)种。对第一个使前缀余额变成−1的位置及之前交换A/B，得到A数N+1、B数N−1的串；此操作与其首次到达+1前缀反射互逆。因此不合法串数为binom(2N,N+1)，合法数是两者之差，等于binom(2N,N)/(N+1)，N=0对应唯一空串。

Legendre求和V精确计数阶乘中的p因子。将Catalan分子分母的p因子全部先消去后，剩余分母是单位，可以模q求逆；指数e≥4恰表示q整除结果，其余情况恢复p^e。单位阶乘递推把1..k中非p倍数因子与p倍数除p后的贡献不重不漏分开，块积依模q周期相同，因此给出正确单位部分。于是两个质数幂余数均正确，互素模数的CRT唯一合并为模10000答案。

## 复杂度

仅预计算16和625两张固定前缀表；每层k除以p，层数O(log(N+1))，每层模快速幂O(log(N+1))，保守时间O(625+log²(N+1))，额外空间O(625)。模乘因子均在小模数内，N相关算术使用Python整数；其他语言至少使用64位容纳2N及N+1。完整int最大值无需线性枚举或大整数阶乘。

## 独立验证

小N用精确大整数binom(2N,N)//(N+1)及直接非负前缀步行DP核验。大N独立oracle使用反射原理的binom(2N,N)−binom(2N,N+1)，分别按p进制滑动四位窗口计算二项式单位因子和进位指数，再用另一种CRT公式合并；它不调用参考Catalan除N+1公式，也不复用其单位阶乘函数。两者仍共享必要的素数幂算术理论，因此额外通过小域精确整数结果打破自我验证。

数据覆盖N=0、原例3、2/5幂邻域、N+1含大量2或5因子的抵消、CRT双余数、2N越过32位、Java int上界与随机大数。三个正常退出负控分别漏CRT、错误排除非可逆N+1、32位2N溢出后返回0。所有正式和oracle均真实执行本站原创参考程序；未运行上游代码。
'''

def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')

# Oracle works on binomial digit windows directly, never divides by N+1.
def binomial_mod(top,bottom,p,power):
 if bottom<0 or bottom>top:return 0
 modulus=p**power;factor=[1]*modulus
 for i in range(1,modulus):factor[i]=factor[i-1]*(i if i%p else 1)%modulus
 other=top-bottom;exponent=0;u,v,w=top,bottom,other
 while u:
  u//=p;v//=p;w//=p;exponent+=u-v-w
 if exponent>=power:return 0
 numerator=denominator=1;block_exponent=0
 u,v,w=top,bottom,other
 while u:
  numerator=numerator*factor[u%modulus]%modulus
  denominator=denominator*factor[v%modulus]*factor[w%modulus]%modulus
  block_exponent+=u//modulus-v//modulus-w//modulus
  u//=p;v//=p;w//=p
 unit=numerator*pow(denominator,-1,modulus)%modulus
 unit=unit*pow(factor[-1],block_exponent,modulus)%modulus
 return unit*p**exponent%modulus
def oracle(n):
 r16=(binomial_mod(2*n,n,2,4)-binomial_mod(2*n,n+1,2,4))%16
 r625=(binomial_mod(2*n,n,5,4)-binomial_mod(2*n,n+1,5,4))%625
 return (r16*625+ r625*16*586)%10000
def prefix_dp(n):
 row=[0]*(n+1);row[0]=1
 for step in range(2*n):
  nxt=[0]*(n+1)
  for balance,value in enumerate(row):
   if balance<n:nxt[balance+1]+=value
   if balance:nxt[balance-1]+=value
  row=nxt
 return row[0]
def run(path,n):
 start=time.perf_counter();p=subprocess.run([sys.executable,'-I',str(path)],input=str(n)+'\n',text=True,capture_output=True,check=True,timeout=5)
 assert not p.stderr
 return p.stdout.strip(),time.perf_counter()-start

def main():
 start=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
 assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 path=OA/f'references/{PID}.py';path.write_text(REFERENCE)
 namespace={'__name__':'authored_reference'};exec(compile(REFERENCE,str(path),'exec'),namespace)
 exact_digest=hashlib.sha256()
 for n in range(1001):
  exact=math.comb(2*n,n)//(n+1);expected=exact%10000
  assert oracle(n)==expected==int(namespace['solve'](str(n)))
  if n<=20:assert prefix_dp(n)==exact
  exact_digest.update(f'{n}:{expected}\n'.encode())
 nums=[3,0,4,1,2,5,7,8,9,15,16,24,25,31,32,63,64,124,125,127,128,255,256,624,625,1023,1024,3124,3125,15624,15625,999999,1000000,1073741822,1073741823,1073741824,MAX-2,MAX-1,MAX,1220703124,1220703125,1220703126,536870911,1048575,1048576,1953124,1953125]
 rng=random.Random(SEED)
 while len(nums)<163:
  value=rng.randrange(MAX+1) if len(nums)%2 else rng.randrange(10001)
  if value not in nums:nums.append(value)
 oracles=[];times=[]
 for n in nums:
  expected=oracle(n);actual,elapsed=run(path,n);assert actual==str(expected),n
  assert expected%2==int((n & (n+1))==0), 'Independent Catalan parity property'
  oracles.append({'input':str(n)+'\n','expectedOutput':str(expected)+'\n'});times.append(elapsed)
 print('Commvault1:1001 exact binomial checks,21 prefix-DP checks,163 unique independent subprocess oracles passed',flush=True)
 cases=[{'name':['原例N3','本站数学边界空串','本站N4不可直接除5'][i] if i<3 else f'指数与CRT边界N{nums[i]}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:55])]
 assert [c['expectedOutput'] for c in cases[:3]]==['5\n','1\n','14\n']
 kills=[]
 for index,mutant in enumerate(MUTANTS,1):
  p=OA/f'negative-controls/{PID}-{index}.py';p.write_text(mutant['code'])
  rejected=[i for i,c in enumerate(cases) if run(p,int(c['input']))[0]!=c['expectedOutput'].strip()]
  assert rejected;kills.append({'name':mutant['name'],'rejectedByCases':rejected,'normalExitVerified':True})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'计数前缀平衡字符串（模10000）','difficulty':'困难','tags':['OA','Commvault','组合数学','数论','中国剩余定理'],
 'description':'统计长度2N、仅含A和B且两者各N个的字符串，其中每个前缀的A数量均不少于B数量。输出数量模10000。',
 'input':'一行非负整数N，0≤N≤2147483647。原Constraints栏为o_o、未提供明确数值上限；本站按原始Java接口int N覆盖整个非负int域，不另造小上限。N=0作为公开数学边界补全：空串符合定义。注意2N可能超过32位有符号数。',
 'output':'输出0..9999内的整数，不要求四位补零。N=0输出1。',
 'explanation':'原例N=3有AAABBB、AABABB、AABBAB、ABAABB、ABABAB五种，输出5。原解释说BABABA的前缀BA中B更多有误，实际违例前缀是B；不改正确原答案。第二例N=0是本站明确补全的空串边界；第三例N=4为本站补充，答案14。',
 'hints':['答案是Catalan数，但不能直接在非素数10000下除以N+1。','分别处理2^4和5^4，先消去质因子，再对单位部分求逆。','用CRT合并，并为2N使用足够宽的整数。'],'timeLimit':2,'memoryLimit':65536,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'python','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'质数幂单位阶乘与CRT','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'catalogContentHash':HASH,'contentHash':HASH,'sourceUrl':source['sourceUrl'],'upstreamCodeExecuted':False,'originalConstraintText':'o_o','originalInterface':'public int countGoodStrings(int N)','siteEnvelope':'0..2147483647 derived from full nonnegative Java int, not explicit original numeric constraints; N=0 empty string mathematically completed and disclosed.','correction':'Original N3 answer5 retained; BABABA violates prefix B, not prefix BA.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'采用原始int接口完整非负域并明确披露类型推导，N0数学补全；质数幂去因子阶乘与CRT覆盖整个域，不假造小N限制；独立二项式差和精确小域验证，仅候选待沙箱。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(set(nums)),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Binomial difference using independent prime-power base-p digit windows and CRT sum formula; exact Python math.comb cross-check for n0..1000, direct nonnegative walk DP n0..20.','exactBinomialChecks':1001,'prefixWalkChecks':21,'exactSmallDigest':exact_digest.hexdigest(),'largeBoundaryResults':[{'n':n,'expected':oracle(n)} for n in [1073741823,1073741824,MAX-2,MAX-1,MAX]],'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'maxLocalSeconds':round(max(times),5),'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print(f'Commvault1 frozen:{len(cases)} formal,163 oracle,3 normal-exit mutants',flush=True)
if __name__=='__main__':main()
