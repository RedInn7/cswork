#!/usr/bin/env python3
"""Box #1 Counterfeit Currency; serial layout and whole-transaction tax recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,string,re
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-box-1';BATCH='box-1-recovered';SEED=20261008001
PATH='fastprep/Box/box-count-counterfeit.md'
N=100000;ALNUM=string.ascii_letters+string.digits;U=string.ascii_uppercase
REFERENCE=r'''#include <cstdio>
#include <cstring>
#include <string>
using namespace std;
static bool up(char c){return c>='A'&&c<='Z';}
static long long value(const char*s){int n=strlen(s);if(n<10||n>12)return 0;
for(int i=0;i<3;i++)if(!up(s[i]))return 0;if(s[0]==s[1]||s[0]==s[2]||s[1]==s[2])return 0;
int y=0;for(int i=3;i<7;i++){if(s[i]<'0'||s[i]>'9')return 0;y=y*10+s[i]-'0';}if(y<1900||y>2019)return 0;
if(!up(s[n-1]))return 0;string v(s+7,s+n-1);
const char*ok[]={"10","20","50","100","200","500","1000"};for(auto o:ok)if(v==o)return stoll(v);return 0;}
int main(){int n;if(scanf("%d",&n)!=1)return 0;char buf[64];long long total=0;
for(int i=0;i<n;i++){scanf("%63s",buf);total+=value(buf);}
printf("%lld\n",total*99/100);}
'''
MUTANTS=[
 {'name':'错误不扣税','language':'cpp','code':REFERENCE.replace('total*99/100','total')},
 {'name':'错误逐枚硬币扣税取整','language':'cpp','code':REFERENCE.replace('total+=value(buf);','total+=value(buf)*99/100;').replace('total*99/100','total')},
 {'name':'错误不检查前三字母互异','language':'cpp','code':REFERENCE.replace('if(s[0]==s[1]||s[0]==s[2]||s[1]==s[2])return 0;','')},
 {'name':'错误年份上限写成2020','language':'cpp','code':REFERENCE.replace('y>2019','y>2020')},
 {'name':'错误32位乘法溢出','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",total*99/100);','printf("%d\\n",(int)total*99/100);')},
]
EDITORIAL='''## 题意

一笔交易由若干硬币序列号组成。合法序列号满足：长度10..12；前3个字符是互不相同的大写字母；接下来4个字符是1900..2019之间的年份；随后若干字符是币值，必须恰好是10、20、50、100、200、500、1000之一；币值后面紧跟的字符就是最后一个字符，必须是大写字母。对合法硬币的币值求和，再从这笔交易的总额中扣除1%的税并向下取整。

## 思路

位置是固定的：前7个字符和最后1个字符之外的中间部分（下标7到倒数第2个）就是币值，长度2..4。逐条检查：长度、前三字母、年份四位数字及范围、末字符大写、中间片段与面额集合做字符串精确比较。合法则累加面额。最后输出⌊总额×99/100⌋，用整数运算即可精确取整。

## 正确性

规则5要求币值之后的“下一个字符”就是最后一个字符，所以币值片段的边界被唯一确定。用字符串精确比较面额，"0020"之类不会被误判为20。税针对整笔交易的总额扣一次，与逐枚扣税取整结果不同。

## 复杂度

O(Σ|s|)。总额最多10^5×1000=10^8，乘99需要64位整数。

## 独立验证

oracle用正则表达式^[A-Z]{3}\\d{4}(10|20|50|100|200|500|1000)[A-Z]$加互异与年份检查，再用Python整数做总额扣税，不复用参考实现的切片逻辑。小域枚举了由合法/各类非法片段组合出的全部序列号并逐个真实运行参考程序。错误解覆盖不扣税（得到1720）、逐枚扣税、漏查互异、年份上限与32位溢出。
'''
PAT=re.compile(r'([A-Z])([A-Z])([A-Z])(\d{4})(10|20|50|100|200|500|1000)[A-Z]')
def encode(a):
 assert 1<=len(a)<=N and all(1<=len(s)<=14 and set(s)<=set(ALNUM) for s in a)
 return f'{len(a)}\n'+'\n'.join(a)+'\n'
def coin(s):
 m=PAT.fullmatch(s)
 if not m or len({m[1],m[2],m[3]})<3 or not 1900<=int(m[4])<=2019:return 0
 return int(m[5])
def oracle(a):return sum(map(coin,a))*99//100
FIRST=['AVG','ABC','AAB','ABA','QWE','aBC','A1C','XYZ'];YEAR=['1900','2019','2020','1899','1984','19A4'];VAL=['10','20','50','100','200','500','1000','400','0020','5','10000','30'];LAST=['T','Z','z','4','']
def main():
 rng=random.Random(SEED)
 sample=['AVG190420T','RTF20001000Z','QWER201850G','AFA199620E','ERT1947200T','RTY20202004','DRV1984500Y','ETB2010400G']
 assert [coin(s) for s in sample]==[20,1000,0,0,200,0,500,0] and oracle(sample)==1702
 def serial():
  r=rng.random()
  if r<0.15:return ''.join(rng.choice(ALNUM) for _ in range(rng.randint(1,14)))
  s=rng.choice(FIRST)+rng.choice(YEAR)+rng.choice(VAL)+rng.choice(LAST)
  if rng.random()<0.5:s=''.join(rng.sample(U,3))+str(rng.randint(1890,2030))+rng.choice(['10','20','50','100','200','500','1000'])+rng.choice(U)
  return s[:14] or 'A'
 small=[sample,['AVG190420T'],['ABC190010A'],['AAA190010A'],['ABC20191000Z'],['ABC20201000Z'],['ABC1899100Z'],['ABC1900100'],['ABC19000020Z'],['ABC1900100ZZ'],['abc1900100Z'],['A'],['ABC190050Q']*3,['XYZ2000100A']*101]
 keys={encode(a) for a in small}
 while len(small)<175:
  a=[serial() for _ in range(rng.randint(1,12))];k=encode(a)
  if k not in keys:keys.add(k);small.append(a)
 oracles=[{'input':encode(a),'expectedOutput':f'{oracle(a)}\n'} for a in small]
 cases=[]
 def add(nm,a,hidden=True,closed=None):
  e=oracle(a)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(a),f'{e}\n',hidden))
 add('样例1',sample,False,1702)
 add('单枚100元',['ABC1999100X'],False,99)
 add('逐枚取整与总额取整不同',['ABC199910A','ABD199910A','ABE199910A'],False,29)
 for i,a in enumerate(small[1:30]):add(f'小规模{i+1}',a)
 def uniq_valid():
  return ''.join(rng.sample(U,3))+str(rng.randint(1900,2019))+rng.choice(['10','20','50','100','200','500','1000'])+rng.choice(U)
 add('满规模全部1000面额',['ABC20191000Z']*N,closed=N*1000*99//100)
 add('满规模全部合法随机',[uniq_valid() for _ in range(N)])
 add('满规模随机混合',[serial() for _ in range(N)])
 add('满规模全部非法',[rng.choice(['AAB19001000Z','ABC20201000Z','ABC1900400Z','ABC19001004','ABC1899100Z']) for _ in range(N)],closed=0)
 add('满规模全部10元',['QWE190010R']*N,closed=N*10*99//100)
 add('满规模随机字母数字串',[''.join(rng.choice(ALNUM) for _ in range(rng.randint(1,14))) for _ in range(N)])
 def exhaustive(run):
  c=0;batch=[]
  for f,y,v,l in product(['ABC','ABA','AbC'],['1900','2019','2020','1899'],['10','20','50','100','200','500','1000','400','0020','5','10000'],['T','z','4']):
   s=(f+y+v+l)[:14];e=coin(s)*99//100
   assert run(encode([s])).split()==[str(e)];c+=1
  return c,{'firstParts':3,'years':4,'values':11,'lastChars':3}
 P=problem(PID,'Box OA #1：识别假币','简单',['字符串','模拟'],
  '一笔加密货币交易由n枚硬币组成，每枚硬币有一个序列号。合法的序列号满足：\n1. 长度为10到12个字符；\n2. 前3个字符是互不相同的大写英文字母；\n3. 接下来4个字符表示铸造年份，必须在1900到2019之间（含）；\n4. 接下来的字符表示币值，必须是10、20、50、100、200、500、1000之一；\n5. 币值之后的下一个字符就是序列号的最后一个字符，序列号必须以恰好一个大写英文字母结尾。\n\n对这笔交易的总额要扣除1%的手续费，且不能有小数，结果向下取整。求所有合法硬币币值之和扣费后的整数。',
  '第一行n；随后n行，每行一个序列号。0<n≤100000，1≤序列号长度≤14，序列号只含英文字母和数字。',
  '输出一个整数：合法硬币币值总和的99%向下取整。',
  '样例1：合法硬币为AVG190420T（20）、RTF20001000Z（1000）、ERT1947200T（200）、DRV1984500Y（500），合计1720，扣除1%后为1702.8，向下取整得1702。QWER201850G年份位置出现R；AFA199620E前三字母不互异；RTY20202004年份越界且末位不是大写字母；ETB2010400G没有400面额。\n样例2：100×0.99=99。\n样例3：三枚10元合计30，扣费后29.7，取整29。',
  ['币值位于第8个字符到倒数第2个字符之间。','币值要与面额集合做精确的字符串比较。','手续费按整笔交易总额计算一次。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'固定位置校验序列号与整笔扣税','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent anchored regular expression plus distinctness/year checks and Python integer tax; exhaustive single-serial combinations of valid and invalid parts; closed forms for uniform full-size inputs.',
  'imageProvenance':IMAGE_PROVENANCE+' Low-resolution HackerRank screenshot (269px wide), read magnified; gives rules 1-5, whole-transaction 1% tax with round-down, the 8-coin example table with Test1..5 marks, and constraints. The buggy starter code it refers to is not shown.',
  'rangeDisclosure':'Original bounds preserved: 0<n<=1e5, 1<=|serial|<=14. Character set restricted to ASCII letters and digits so whitespace-token stdin is unambiguous. Stdin: n then n serials.',
  'corrections':['Sample output corrected from 1720 to 1702: the image itself only states the valid coins sum to 20+1000+200+500=1720, and its rule takes 1% from the total transaction rounded down, floor(1720*0.99)=1702 (independently recomputed).','Upstream md serial RTF200010002 corrected to image RTF20001000Z (valid, value 1000); DRV1984500V corrected to image DRV1984500Y.','Tax applies to the whole transaction total (image), not per valid coin (md wording).','Second and third public examples are authored.'],
  'reason':'原图给出5条序列号规则（币值为第8位到倒数第2位）和按整笔交易扣1%向下取整，样例按规则复算为1702；正则独立oracle与组合穷举核验。'})
if __name__=='__main__':main()
