"""Original non-scalar fixtures. Sources/README identities read only; no downloaded execution."""
import itertools
import math
from collections import Counter
from functools import lru_cache

IDS=[12,71,151,917,179,345,541,557,1047,1071,1209,1544,2000,2390,238,338,739,763,977,1356,1475,1652,1720,1920,2433,17,22,260,438,442]
METHODS=dict(zip(IDS,['intToRoman','simplifyPath','reverseWords','reverseOnlyLetters','largestNumber','reverseVowels','reverseStr','reverseWords','removeDuplicates','gcdOfStrings','removeDuplicates','makeGood','reversePrefix','removeStars','productExceptSelf','countBits','dailyTemperatures','partitionLabels','sortedSquares','sortByBits','finalPrices','decrypt','decode','buildArray','findArray','letterCombinations','generateParenthesis','singleNumber','findAnagrams','findDuplicates']))
STRING_IDS={12,71,151,917,179,345,541,557,1047,1071,1209,1544,2000,2390}
INT_SET_IDS={260,438,442}
STRING_SET_IDS={17,22}
KEYS={'2':'abc','3':'def','4':'ghi','5':'jkl','6':'mno','7':'pqrs','8':'tuv','9':'wxyz'}
VOWELS=set('aeiouAEIOU')


def deletion_oracle(s,kind,k=2):
 @lru_cache(None)
 def solve(v):
  nexts=[]
  for i in range(len(v)-k+1):
   chosen=v[i:i+k]
   if (len(set(chosen))==1 if kind=='equal' else chosen[0]!=chosen[1] and chosen[0].lower()==chosen[1].lower()):nexts.append(solve(v[:i]+v[i+k:]))
  return min(nexts,key=lambda x:(len(x),x)) if nexts else v
 return solve(s)


def oracle(pid,args):
 a=args[0]
 if pid==12:
  places=[['','I','II','III','IV','V','VI','VII','VIII','IX'],['','X','XX','XXX','XL','L','LX','LXX','LXXX','XC'],['','C','CC','CCC','CD','D','DC','DCC','DCCC','CM'],['','M','MM','MMM']]
  return ''.join(places[i][a//10**i%10] for i in (3,2,1,0))
 if pid==71:
  parts=[p for p in a.split('/') if p and p!='.']
  while '..' in parts:
   i=parts.index('..');parts[max(0,i-1):i+1]=[]
  return '/'+'/'.join(parts)
 if pid==151:return ' '.join([w for w in a.split(' ') if w][::-1])
 if pid in (345,917):
  keep=lambda c:c in VOWELS if pid==345 else ('a'<=c<='z' or 'A'<=c<='Z')
  rev=[c for c in a if keep(c)][::-1];it=iter(rev)
  return ''.join(next(it) if keep(c) else c for c in a)
 if pid==179:return str(max(int(''.join(map(str,p))) for p in itertools.permutations(a)))
 if pid==541:
  k=args[1];return ''.join(a[start:start+k][::-1]+a[start+k:start+2*k] for start in range(0,len(a),2*k))
 if pid==557:return ' '.join(word[::-1] for word in a.split(' '))
 if pid in (1047,1209,1544):return deletion_oracle(a,'case' if pid==1544 else 'equal',args[1] if pid==1209 else 2)
 if pid==1071:
  b=args[1]
  return max((a[:k] for k in range(1,len(a)+1) if len(a)%k==0 and len(b)%k==0 and a[:k]*(len(a)//k)==a and a[:k]*(len(b)//k)==b),key=len,default='')
 if pid==2000:
  i=next((i for i,c in enumerate(a) if c==args[1]),-1)
  return a if i<0 else a[:i+1][::-1]+a[i+1:]
 if pid==2390:
  while '*' in a:
   i=a.index('*');a=a[:i-1]+a[i+1:]
  return a
 if pid==238:return [math.prod(a[:i]+a[i+1:]) for i in range(len(a))]
 if pid==338:return [sum((v>>i)&1 for i in range(17)) for v in range(a+1)]
 if pid==739:return [next((j-i for j in range(i+1,len(a)) if a[j]>a[i]),0) for i in range(len(a))]
 if pid==763:
  @lru_cache(None)
  def partition(i):
   if i==len(a):return ()
   candidates=[(j-i,)+partition(j) for j in range(i+1,len(a)+1) if not(set(a[i:j])&set(a[j:]))]
   return max(candidates,key=len)
  return list(partition(0))
 if pid==977:return sorted(x*x for x in a)
 if pid==1356:return sorted(a,key=lambda x:(sum(int(c) for c in bin(x)[2:]),x))
 if pid==1475:return [x-next((y for y in a[i+1:] if y<=x),0) for i,x in enumerate(a)]
 if pid==1652:
  k=args[1];return [sum(a[(i+(1 if k>0 else -1)*d)%len(a)] for d in range(1,abs(k)+1)) for i in range(len(a))]
 if pid==1720:
  result=[args[1]]
  for x in a:result.append(sum((1<<bit) for bit in range(17) if ((result[-1]>>bit)&1)!=((x>>bit)&1)))
  return result
 if pid==1920:return [a[a[i]] for i in range(len(a))]
 if pid==2433:return [sum(1<<bit for bit in range(20) if ((a[i]>>bit)&1)!=(((a[i-1] if i else 0)>>bit)&1)) for i in range(len(a))]
 if pid==17:return [''.join(s) for s in itertools.product(*(KEYS[c] for c in a))]
 if pid==22:
  out=[]
  for p in itertools.product('()',repeat=2*a):
   balance=0
   for c in p:
    balance+=1 if c=='(' else -1
    if balance<0:break
   else:
    if balance==0:out.append(''.join(p))
  return out
 if pid==260:return [x for x in a if a.count(x)==1]
 if pid==438:return [i for i in range(len(a)-len(args[1])+1) if sorted(a[i:i+len(args[1])])==sorted(args[1])]
 if pid==442:return sorted({x for x in a if a.count(x)==2})
 raise KeyError(pid)


def random_args(pid,r):
 n=r.randint(1,7);word=lambda alphabet,n=n:''.join(r.choice(alphabet) for _ in range(n))
 if pid==12:return [r.randint(1,3999)]
 if pid==71:return ['/'+'/'.join(r.choice(['a','B','..','.','...','','x_y','a9']) for _ in range(n))]
 if pid==151:return [' '*r.randrange(3)+(' '*r.randint(1,3)).join(word('aB12',r.randint(1,4)) for _ in range(n))+' '*r.randrange(3)]
 if pid==917:return [word('aBzY1-![]')]
 if pid==179:return [[r.randint(0,99) for _ in range(min(n,6))]]
 if pid==345:return [word('aEiOUxb Z9!')]
 if pid==541:return [word('abc'),r.randint(1,10)]
 if pid==557:return [' '.join(word('aB!12',r.randint(1,5)) for _ in range(n))]
 if pid==1047:return [word('abc')]
 if pid==1071:return [word('ABC'),word('ABC',r.randint(1,7))]
 if pid==1209:return [word('abc'),r.randint(2,5)]
 if pid==1544:return [word('aAbBcC')]
 if pid==2000:return [word('abc'),r.choice('abcd')]
 if pid==2390:
  s='';remaining=0
  for _ in range(n):
   if remaining and r.randrange(3)==0:s+='*';remaining-=1
   else:s+=r.choice('abc');remaining+=1
  return [s]
 if pid==238:return [[r.randint(-3,3) for _ in range(max(2,n))]]
 if pid==338:return [r.randint(0,80)]
 if pid==739:return [[r.randint(30,40) for _ in range(n)]]
 if pid==763:return [word('abc')]
 if pid==977:return [sorted(r.randint(-10,10) for _ in range(n))]
 if pid==1356:return [[r.randint(0,40) for _ in range(n)]]
 if pid==1475:return [[r.randint(1,20) for _ in range(n)]]
 if pid==1652:return [[r.randint(1,10) for _ in range(n)],r.randint(1-n,n-1)]
 if pid==1720:return [[r.randint(0,31) for _ in range(n)],r.randint(0,31)]
 if pid==1920:
  a=list(range(n));r.shuffle(a);return [a]
 if pid==2433:return [[r.randint(0,63) for _ in range(n)]]
 if pid==17:return [word('23456789',r.randint(1,4))]
 if pid==22:return [r.randint(1,5)]
 if pid==260:
  vals=r.sample(range(-20,21),max(2,n));a=vals[:2]+vals[2:]*2;r.shuffle(a);return [a]
 if pid==438:return [word('abc'),word('abc',r.randint(1,5))]
 if pid==442:
  a=r.sample(list(range(1,n+1))*2,n);r.shuffle(a);return [a]
 raise KeyError(pid)

EDGE={12:[[3749],[4],[9],[58],[1994]],71:[['/home/'],['/../'],['/home//foo/'],['/a/./b/../../c/'],['/.../a/../b']],151:[['the sky is blue'],['  hello world  '],['a good   example'],['x']],917:[['ab-cd'],['a-bC-dEf-ghIj'],['123!?'],['Aa']],179:[[[10,2]],[[3,30,34,5,9]],[[0,0]],[[121,12]],[[8308,830]]],345:[['IceCreAm'],['aA'],['bcdf'],[' aE!']],541:[['abcdefg',2],['abcd',2],['a',10],['abcdef',4]],557:[["Let's take LeetCode contest"],['a'],['Ab C!']],1047:[['abbaca'],['a'],['abba'],['aa']],1071:[['ABCABC','ABC'],['ABABAB','ABAB'],['LEET','CODE'],['A','A']],1209:[['deeedbbcccbdaa',3],['abcd',2],['pbbcggttciiippooaais',2],['aa',2]],1544:[['leEeetcode'],['abBAcC'],['s'],['aa']],2000:[['abcdefd','d'],['xyxzxe','z'],['abcd','z']],2390:[['leet**cod*e'],['erase*****'],['abc'],['ab*c']],238:[[[1,2,3,4]],[[-1,1,0,-3,3]],[[0,0]],[[2,3]]],338:[[5],[0],[1],[16]],739:[[[73,74,75,71,69,72,76,73]],[[30]],[[30,30]],[[31,30,32]]],763:[['ababcbacadefegdehijhklij'],['a'],['abc'],['abac']],977:[[[-4,-1,0,3,10]],[[-7,-3,2,3,11]],[[0]],[[-2,-2]]],1356:[[[0,1,2,3,4,5,6,7,8]],[[1024,512,256]],[[3,3,2]]],1475:[[[8,4,6,2,3]],[[1,2,3,4,5]],[[10,1,1]]],1652:[[[5,7,1,4],3],[[1,2,3,4],0],[[2,4,9,3],-2],[[1],0]],1720:[[[1,2,3],1],[[0],0],[[100000],100000]],1920:[[[0,2,1,5,3,4]],[[0]],[[1,0]]],2433:[[[5,2,0,3,1]],[[13]],[[0,0]]],17:[['23'],['2'],['7'],['79']],22:[[3],[1],[2]],260:[[[1,2,1,3,2,5]],[[0,1]],[[-1,0]],[[2,2,-3,-4]]],438:[['cbaebabacd','abc'],['abab','ab'],['a','b'],['a','aa']],442:[[[4,3,2,7,8,2,3,1]],[[1,1,2]],[[1]],[[2,2]]]}

PRESSURE={12:[([3999],'MMMCMXCIX'),([3888],'MMMDCCCLXXXVIII')],71:[(['/'*3000],'/'),(['/'+'a/'*1499+'a'],'/'+'a/'*1499+'a')],151:[(['a'*10000],'a'*10000)],917:[(['a'*50+'B'*50],'B'*50+'a'*50)],179:[([[10**9]*100],'1000000000'*100),([[0]*100],'0')],345:[(['a'*150000+'E'*150000],'E'*150000+'a'*150000)],541:[(['a'*9999+'b',10000],'b'+'a'*9999)],557:[(['ab '*16666+'ab'],'ba '*16666+'ba')],1047:[(['ab'*50000],'ab'*50000),(['a'*100000],'')],1071:[(['A'*1000,'A'*1000],'A'*1000),(['AB'*500,'AB'*499],'AB')],1209:[(['ab'*50000,10000],'ab'*50000),(['a'*100000,10000],'')],1544:[(['aA'*50],'')],2000:[(['a'*249+'b','b'],'b'+'a'*249)],2390:[(['a'*100000],'a'*100000),(['a'*50000+'*'*50000],'')],238:[([[1]*100000],[1]*100000),([[0]*100000],[0]*100000)],338:[([100000],[bin(i).count('1') for i in range(100001)])],739:[([[100]*100000],[0]*100000),([[30]*99999+[100]],list(range(99999,0,-1))+[0])],763:[(['a'*500],[500])],977:[([[-10000]*5000+[10000]*5000],[100000000]*10000)],1356:[([[10000]*500],[10000]*500)],1475:[([[1000]*500],[0]*499+[1000])],1652:[([[100]*100,99],[9900]*100),([[100]*100,-99],[9900]*100)],1720:[([[100000]*9999,100000],[100000,0]*5000)],1920:[([list(range(999,-1,-1))],list(range(1000)))],2433:[([[1000000]*100000],[1000000]+[0]*99999)],17:[(['9999'],[''.join(v) for v in itertools.product('wxyz',repeat=4)])],22:[([8],oracle(22,[8]))],260:[([list(range(14999))*2+[-2147483648,2147483647]],[-2147483648,2147483647])],438:[(['a'*30000,'a'],list(range(30000))),(['a'*30000,'a'*30000],[0])],442:[([list(range(1,50001))*2],list(range(1,50001)))]}

SCALAR={12,338,22}
TWO_STRINGS={1071,2000,438}
STRING_K={541,1209}
ARRAY_K={1652,1720}
ARRAY_IDS={179,238,739,977,1356,1475,1652,1720,1920,2433,260,442}

def encode(pid,a):
 if pid in SCALAR:return str(a[0])+'\n'
 if pid in STRING_K:return a[0]+'\n'+str(a[1])+'\n'
 if pid in TWO_STRINGS:return '\n'.join(a)+'\n'
 if pid in ARRAY_IDS:return str(len(a[0]))+(' '+str(a[1]) if pid in ARRAY_K else '')+'\n'+' '.join(map(str,a[0]))+'\n'
 return a[0]+'\n'

def parse(pid):
 if pid in SCALAR:return 'args=[int(sys.stdin.read())]'
 if pid in STRING_K:return "args=[sys.stdin.readline().rstrip('\\r\\n'),int(sys.stdin.readline())]"
 if pid in TWO_STRINGS:return "args=[sys.stdin.readline().rstrip('\\r\\n') for _ in range(2)]"
 if pid in ARRAY_IDS:
  extra=1 if pid in ARRAY_K else 0
  return f'v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==n+{extra+1}; args=[v[{extra+1}:]]+v[1:{extra+1}]'
 return "args=[sys.stdin.readline().rstrip('\\r\\n')]"

LIMITS={179:(1,100,0,10**9),238:(2,100000,-30,30),739:(1,100000,30,100),977:(1,10000,-10000,10000),1356:(1,500,0,10000),1475:(1,500,1,1000),1652:(1,100,1,100),1720:(1,9999,0,100000),1920:(1,1000,0,999),2433:(1,100000,0,1000000),260:(2,30000,-2**31,2**31-1),442:(1,100000,1,100000)}
STRLIMITS={71:3000,151:10000,917:100,345:300000,541:10000,557:50000,1047:100000,1071:1000,1209:100000,1544:100,2000:250,2390:100000,763:500,17:4,438:30000}

def validate(pid,args):
 assert type(args)is list and len(args)==(2 if pid in TWO_STRINGS|STRING_K|ARRAY_K else 1)
 a=args[0]
 if pid in SCALAR:
  lo,hi={12:(1,3999),338:(0,100000),22:(1,8)}[pid];assert type(a)is int and lo<=a<=hi;return
 if pid in ARRAY_IDS:
  lo,hi,vlo,vhi=LIMITS[pid];assert type(a)is list and lo<=len(a)<=hi and all(type(x)is int and vlo<=x<=vhi for x in a)
  if pid==238:
   # Every prefix/suffix product AND each excluded-element product must fit.
   pre=[1];prod=1
   for x in a:prod*=x;assert -2**31<=prod<=2**31-1;pre.append(prod)
   suf=1
   for i in range(len(a)-1,-1,-1):
    assert -2**31<=pre[i]*suf<=2**31-1
    suf*=a[i];assert -2**31<=suf<=2**31-1
  if pid==977:assert a==sorted(a)
  if pid==1652:assert type(args[1])is int and 1-len(a)<=args[1]<=len(a)-1
  if pid==1720:assert type(args[1])is int and 0<=args[1]<=100000
  if pid==1920:assert sorted(a)==list(range(len(a)))
  if pid==260:
   c=Counter(a);assert list(c.values()).count(1)==2 and all(v in (1,2) for v in c.values())
  if pid==442:assert all(x<=len(a) for x in a) and max(Counter(a).values())<=2
  return
 for index,s in enumerate(args if pid in TWO_STRINGS else args[:1]):
  maxlen=1 if pid==2000 and index==1 else STRLIMITS[pid]
  assert type(s)is str and 1<=len(s)<=maxlen
  if pid in (345,557):assert all(32<=ord(c)<=126 for c in s)
  elif pid==917:assert all(33<=ord(c)<=122 and c not in '\\"' for c in s)
  elif pid==151:assert all(c==' ' or c.isascii() and c.isalnum() for c in s)
  elif pid==71:assert all(c in './_' or c.isascii() and c.isalnum() for c in s)
  elif pid==1544:assert all(c.isascii() and c.isalpha() for c in s)
  elif pid==1071:assert all('A'<=c<='Z' for c in s)
  elif pid==17:assert all(c in KEYS for c in s)
  else:assert all('a'<=c<='z' or (pid==2390 and c=='*') for c in s)
 if pid==71:assert a.startswith('/')
 if pid==151:assert a.strip(' ')
 if pid==557:assert not a.startswith(' ') and not a.endswith(' ') and '  ' not in a
 if pid==541:assert type(args[1])is int and 1<=args[1]<=10000
 if pid==1209:assert type(args[1])is int and 2<=args[1]<=10000
 if pid==2390:
  balance=0
  for c in a:balance+=-1 if c=='*' else 1;assert balance>=0

META={
12:('整数转罗马数字','Integer to Roman','将 num 写为标准罗马数字，用 I/V/X/L/C/D/M，减法形式仅为 IV、IX、XL、XC、CD、CM。','Write num in standard Roman notation using I,V,X,L,C,D,M. The only subtractive forms are IV, IX, XL, XC, CD and CM.'),
71:('简化路径','Simplify Path','简化绝对Unix路径：忽略重复斜线和单独的点，双点返回父目录且不能超过根目录，其他名称原样保留。结果以一个/开头，目录之间单个/，除根目录外无末尾/。','Canonicalize an absolute Unix path: ignore repeated slashes and single-dot components; double dots move to the parent without going above root. Preserve other names. Use one initial slash, single separators and no trailing slash except at root.'),
151:('反转字符串中的单词','Reverse Words in a String','单词是非空格连续片段。将单词顺序反转，单词内部不变，结果单词间仅一个空格且无首尾空格。','A word is a maximal non-space fragment. Reverse word order without changing the words. Separate output words by one space and omit leading/trailing spaces.'),
917:('仅仅反转字母','Reverse Only Letters','反转所有英文字母的相对顺序，其他字符留在原下标，保留字母大小写。','Reverse the relative order of English letters, keeping every other character at its original index and preserving letter case.'),
179:('最大数','Largest Number','任意排列所有非负整数的十进制表示并拼接，返回最大的结果字符串。若所有数都是0，只输出一个0。','Arrange and concatenate the decimal representations of every nonnegative input integer to maximize the result. Return a string; if all values are zero, return a single 0.'),
345:('反转字符串中的元音字母','Reverse Vowels of a String','仅反转元音a/e/i/o/u及其大写形式的相对顺序，其余字符下标不变，保留大小写与空格。','Reverse only the relative order of a,e,i,o,u and their uppercase forms. Keep other characters fixed and preserve case and spaces.'),
541:('反转字符串II','Reverse String II','从开头起每2k个字符一组，仅反转该组前k个字符；剩余不足k则全部反转，剩余介于k和2k则只反转前k个。','Process blocks of 2k characters from the start, reversing only the first k. Reverse all characters if fewer than k remain; otherwise reverse the first k of the final block.'),
557:('反转字符串中的单词III','Reverse Words in a String III','将每个单词内部的字符顺序反转，单词之间的单个空格及单词顺序保持不变。','Reverse characters inside each word, preserving word order and the single spaces between words.'),
1047:('删除字符串中的所有相邻重复项','Remove All Adjacent Duplicates In String','重复删除任意两个相邻且相同的字符，直至无法删除，返回唯一最终字符串，可以为空。','Repeatedly delete any two adjacent equal characters until no deletion is possible. Return the unique final string, which may be empty.'),
1071:('字符串的最大公因子','Greatest Common Divisor of Strings','返回最长非空字符串x，使两个输入串都能由x重复若干次得到；不存在则返回空串。','Return the longest nonempty string x whose repetitions form both inputs. Return the empty string if none exists.'),
1209:('删除字符串中的所有相邻重复项II','Remove All Adjacent Duplicates in String II','每次删除恰好k个相邻且相同的字符，可继续删除新形成的片段，返回无法再删除时的唯一字符串，可以为空。','Repeatedly delete exactly k adjacent equal characters, including newly formed groups, until no deletion remains. Return the unique final string, possibly empty.'),
1544:('整理字符串','Make The String Great','反复删除相邻的一对同字母不同大小写字符，直到不能继续，返回唯一最终字符串。相同大小写不能删除。','Repeatedly remove adjacent copies of the same letter in opposite cases. Equal-case pairs do not qualify. Return the unique final string.'),
2000:('反转单词前缀','Reverse Prefix of Word','找到word中首次出现ch的下标，将从开头到该字符的闭区间反转，其余不变；找不到则返回原串。','Reverse the prefix ending at the first occurrence of ch in word, including ch. Leave the suffix unchanged; return the original word if ch is absent.'),
2390:('从字符串中移除星号','Removing Stars From a String','每个星号删除自身及左侧最近的尚未删除字母，最终移除所有星号。保证操作可完成，返回剩余字符串。','Each star removes itself and the nearest remaining letter to its left. Remove all stars; the operations are guaranteed feasible. Return the remaining text.'),
238:('除自身以外数组的乘积','Product of Array Except Self','按原下标返回数组：第i项为除nums[i]以外所有元素的乘积。要求线性时间且不能使用除法。','Return an array in original index order whose ith entry is the product of every value except nums[i]. The intended algorithm runs in linear time without division.'),
338:('比特位计数','Counting Bits','返回长度n+1的数组，第i项为非负整数i的二进制表示中1的个数，0对应0。','Return n+1 entries: entry i is the count of ones in binary i, including entry 0 equal to zero.'),
739:('每日温度','Daily Temperatures','对每个下标返回直到下一次严格更高温度的等待天数；后面没有更高温度则该项为0。','For each index return days until the next strictly warmer temperature. Use 0 if no later warmer temperature exists.'),
763:('划分字母区间','Partition Labels','将整个字符串切为尽可能多的非空连续段，要求同一字母只能出现在一段内，按顺序返回每段长度。','Partition the whole string into as many nonempty contiguous parts as possible, with each letter appearing in only one part. Return part lengths in order.'),
977:('有序数组的平方','Squares of a Sorted Array','将数组每项平方后按非递减顺序返回，保留重复值。','Square every array value and return all squares in nondecreasing order, preserving duplicates.'),
1356:('根据数字二进制下1的数目排序','Sort Integers by The Number of 1 Bits','先按二进制1的数量升序，再按整数本身升序排序，保留所有重复元素。','Sort by ascending binary set-bit count, breaking ties by ascending integer value. Preserve every duplicate.'),
1475:('商品折扣后的最终价格','Final Prices With a Special Discount in a Shop','对每个价格，找到右侧第一个不大于它的价格作为折扣并减去；找不到则不折扣，按原顺序返回。','Discount each price by the first later price less than or equal to it. If absent, keep the original price. Return results in original order.'),
1652:('拆炸弹','Defuse the Bomb','循环数组中k>0时每项替换为后k项之和，k<0时替换为前|k|项之和，k=0时全部为0。所有替换同时进行，使用原数组数值。','In a circular array, replace each entry with the sum of the next k values when k>0, the previous |k| when k<0, or 0 when k=0. All replacements use the original values simultaneously.'),
1720:('解码异或后的数组','Decode XORed Array','已知encoded[i]=arr[i]按位异或arr[i+1]，并给出arr[0]=first。恢复并返回完整arr，长度比encoded多1。','Given encoded[i]=arr[i] XOR arr[i+1] and arr[0]=first, recover the entire arr, which has one more entry than encoded.'),
1920:('基于排列构建数组','Build Array from Permutation','给定从0到n-1的一个排列，按下标返回answer[i]=nums[nums[i]]。','Given a permutation of 0 through n−1, return answer[i]=nums[nums[i]] in index order.'),
2433:('找出前缀异或的原始数组','Find The Original Array of Prefix Xor','pref[i]等于原数组从下标0到i的所有元素按位异或。恢复并按顺序返回原数组。','pref[i] is the XOR of original entries from index 0 through i. Recover the original array in order.'),
17:('电话号码的字母组合','Letter Combinations of a Phone Number','数字2至9分别对应abc、def、ghi、jkl、mno、pqrs、tuv、wxyz。为每一位选择一个对应字母，返回所有组合，顺序任意、不重复。','Digits 2–9 map respectively to abc, def, ghi, jkl, mno, pqrs, tuv, wxyz. Choose one mapped letter per digit and return every combination, in any order without duplicates.'),
22:('括号生成','Generate Parentheses','返回由n对括号构成的所有合法括号串。每个前缀右括号不能多于左括号，总数相等。返回顺序任意，不重复。','Return all balanced strings using n pairs of parentheses: no prefix has more closing than opening parentheses, and total counts match. Any order is accepted; no duplicates.'),
260:('只出现一次的数字III','Single Number III','恰有两个不同的值各出现一次，其余每个值出现两次。返回这两个只出现一次的值，顺序任意。','Exactly two distinct values occur once; every other value occurs twice. Return the two singleton values in any order.'),
438:('找到字符串中所有字母异位词','Find All Anagrams in a String','找出s中所有与p具有相同字符及次数的连续子串，返回起始下标集合（从0开始），顺序任意、不重复。','Find contiguous substrings of s with the same character multiplicities as p. Return their zero-based start indices in any order without duplicates.'),
442:('数组中重复的数据','Find All Duplicates in an Array','每个值出现一次或两次，返回所有出现两次的值，每个只返回一次，顺序任意。','Each value appears once or twice. Return each value that appears twice exactly once, in any order.'),
}

INPUT={
12:('一行num，1≤num≤3999。','One integer num, 1≤num≤3999.'),
71:('一行绝对路径，以/开头，长度1–3000，仅英文字母、数字、点、斜线和下划线。','One absolute path starting with /, length 1–3000; English letters, digits, periods, slashes and underscores only.'),
151:('一行字符串，长度1–10000，仅英文字母、数字和空格，保证至少一个单词；保留输入首尾及重复空格。','One line, length 1–10000, containing English letters, digits and spaces with at least one word. Preserve input leading, trailing and repeated spaces.'),
917:('一行字符串，长度1–100，ASCII码33至122，不含双引号或反斜线。','One string, length 1–100, ASCII codes 33–122, excluding double quote and backslash.'),
179:('第一行n；第二行n个整数。1≤n≤100，值在[0,1000000000]。','First line: n. Second: n integers. 1≤n≤100; values in [0,1000000000].'),
345:('一行字符串，长度1–300000，仅可打印ASCII字符（码32至126）；空格均有效。','One line, length 1–300000; printable ASCII codes 32–126 only. All spaces are significant.'),
541:('第一行小写英文字符串s，第二行k；1≤s长度≤10000，1≤k≤10000。','First line: lowercase English string s. Second: k. Length 1–10000; 1≤k≤10000.'),
557:('一行字符串，长度1–50000，仅可打印ASCII；无首尾空格，单词间恰好一个空格，至少一个单词。','One line, length 1–50000, printable ASCII only. No leading/trailing spaces; words separated by exactly one space; at least one word.'),
1047:('一行小写英文字符串，长度1–100000。','One lowercase English string, length 1–100000.'),
1071:('两行字符串str1、str2，长度均为1–1000，仅大写英文字母。','Two lines: str1 and str2, each length 1–1000; uppercase English letters only.'),
1209:('第一行小写英文字符串s，第二行k。1≤s长度≤100000，2≤k≤10000。','First line: lowercase English string s. Second: k. Length 1–100000; 2≤k≤10000.'),
1544:('一行仅含大小写英文字母的字符串，长度1–100。','One string of uppercase/lowercase English letters, length 1–100.'),
2000:('第一行word，第二行单个字符ch。word长度1–250，word和ch均仅小写英文字母。','First line: word. Second: one character ch. Word length 1–250; both use lowercase English letters only.'),
2390:('一行字符串，长度1–100000，仅小写英文字母和*；每个前缀中字母数至少等于星号数，保证可完成删除。','One line, length 1–100000, lowercase English letters and * only. Every prefix has at least as many letters as stars, ensuring all removals are feasible.'),
238:('第一行n；第二行n个整数。2≤n≤100000，值在[-30,30]。每个前缀积、后缀积及每个答案均在[-2147483648,2147483647]。','First line: n. Second: n integers. 2≤n≤100000; values in [-30,30]. Every prefix product, suffix product and answer entry fits [-2147483648,2147483647].'),
338:('一行n，0≤n≤100000。','One integer n, 0≤n≤100000.'),
739:('第一行n；第二行n个温度。1≤n≤100000，温度在[30,100]。','First line: n. Second: n temperatures. 1≤n≤100000; temperatures in [30,100].'),
763:('一行小写英文字符串，长度1–500。','One lowercase English string, length 1–500.'),
977:('第一行n；第二行n个非递减整数。1≤n≤10000，值在[-10000,10000]。','First line: n. Second: n nondecreasing integers. 1≤n≤10000; values in [-10000,10000].'),
1356:('第一行n；第二行n个整数。1≤n≤500，值在[0,10000]。','First line: n. Second: n integers. 1≤n≤500; values in [0,10000].'),
1475:('第一行n；第二行n个价格。1≤n≤500，价格在[1,1000]。','First line: n. Second: n prices. 1≤n≤500; prices in [1,1000].'),
1652:('第一行n k；第二行n个整数。1≤n≤100，值在[1,100]，-(n-1)≤k≤n-1。','First line: n k. Second: n integers. 1≤n≤100; values in [1,100]; -(n−1)≤k≤n−1.'),
1720:('第一行m first，第二行encoded的m个整数。1≤m≤9999，encoded元素和first在[0,100000]；输出数组长度m+1。','First line: m first. Second: m encoded integers. 1≤m≤9999; encoded values and first in [0,100000]. The restored array has m+1 entries.'),
1920:('第一行n；第二行n个整数，为0至n-1的排列。1≤n≤1000。','First line: n. Second: a permutation of 0 through n−1. 1≤n≤1000.'),
2433:('第一行n；第二行pref的n个整数。1≤n≤100000，值在[0,1000000]。','First line: n. Second: n pref integers. 1≤n≤100000; values in [0,1000000].'),
17:('一行数字字符串digits，长度1–4，每位为2至9。','One digit string digits, length 1–4, with each digit from 2 through 9.'),
22:('一行n，1≤n≤8。','One integer n, 1≤n≤8.'),
260:('第一行n；第二行n个整数。2≤n≤30000，值在[-2147483648,2147483647]；恰有两值各出现一次，其余各两次。','First line: n. Second: n integers. 2≤n≤30000; values in [-2147483648,2147483647]; exactly two occur once, all others twice.'),
438:('第一行s，第二行p，均仅小写英文字母，长度均为1–30000。','First line: s. Second: p. Both use lowercase English letters and have lengths 1–30000.'),
442:('第一行n；第二行n个整数。1≤n≤100000，1≤每个值≤n，每个不同值出现一次或两次。','First line: n. Second: n integers. 1≤n≤100000; values in [1,n]; each distinct value appears once or twice.'),
}

WRONG={
12:('omits all subtractive Roman forms',"n=args[0]; result=''\nfor v,c in ((1000,'M'),(500,'D'),(100,'C'),(50,'L'),(10,'X'),(5,'V'),(1,'I')):\n result+=c*(n//v); n%=v"),
71:('drops parent components without removing their directory',"result='/'+'/'.join(x for x in args[0].split('/') if x not in ('','.','..'))"),
151:('reverses characters rather than word order',"result=args[0].strip()[::-1]"),
917:('also reverses nonletter positions',"result=args[0][::-1]"),
179:('sorts numerically rather than by concatenation order',"result=''.join(map(str,sorted(args[0],reverse=True))); result='0' if set(result)=={'0'} else result"),
345:('ignores uppercase vowels',"s=args[0]; v=iter([c for c in s if c in 'aeiou'][::-1]); result=''.join(next(v) if c in 'aeiou' else c for c in s)"),
541:('reverses every k-block rather than alternate k-blocks',"s,k=args; result=''.join(s[i:i+k][::-1] for i in range(0,len(s),k))"),
557:('reverses word order instead of each word',"result=' '.join(args[0].split(' ')[::-1])"),
1047:('performs only one deletion pass',r"result=re.sub(r'(.)\1','',args[0])"),
1071:('returns common prefix without checking whole-string repetition',"a,b=args; i=0\nwhile i<min(len(a),len(b)) and a[i]==b[i]:i+=1\nresult=a[:i]"),
1209:('does not revisit newly adjacent equal groups',r"s,k=args; result=re.sub(r'(.)\1{'+str(k-1)+'}', '', s)"),
1544:('removes same-case pairs instead of opposite-case pairs',r"result=re.sub(r'(.)\1','',args[0])"),
2000:('uses last rather than first occurrence',"s,c=args; i=s.rfind(c); result=s if i<0 else s[:i+1][::-1]+s[i+1:]"),
2390:('removes stars but retains their deleted letters',"result=args[0].replace('*','')"),
238:('includes the current element in each product',"result=[math.prod(args[0])]*len(args[0])"),
338:('returns bit lengths rather than popcounts',"result=[x.bit_length() for x in range(args[0]+1)]"),
739:('accepts an equal temperature as warmer',"a=args[0]; result=[next((j-i for j in range(i+1,len(a)) if a[j]>=a[i]),0) for i in range(len(a))]"),
763:('partitions into contiguous runs instead of full letter spans',"result=[len(list(g)) for _,g in itertools.groupby(args[0])]"),
977:('squares in input order without sorting',"result=[x*x for x in args[0]]"),
1356:('sorts by value alone',"result=sorted(args[0])"),
1475:('uses smallest later price instead of first qualifying price',"a=args[0]; result=[x-min((y for y in a[i+1:] if y<=x),default=0) for i,x in enumerate(a)]"),
1652:('uses following values even for negative k',"a,k=args; result=[sum(a[(i+d)%len(a)] for d in range(1,abs(k)+1)) for i in range(len(a))]"),
1720:('omits the known first entry',"result=[]; prev=args[1]\nfor x in args[0]:prev^=x;result.append(prev)"),
1920:('returns the permutation without composing it',"result=args[0]"),
2433:('subtracts adjacent prefixes instead of XOR',"a=args[0]; result=[a[i]-(a[i-1] if i else 0) for i in range(len(a))]"),
17:('chooses only the first mapped letter of each digit',"result=[''.join({'2':'a','3':'d','4':'g','5':'j','6':'m','7':'p','8':'t','9':'w'}[c] for c in args[0])]"),
22:('returns only the fully nested shape',"result=['('*args[0]+')'*args[0]]"),
260:('returns paired values instead of singleton values',"result=[x for x,n in collections.Counter(args[0]).items() if n==2]"),
438:('requires exact text rather than anagrams',"s,p=args; result=[i for i in range(len(s)-len(p)+1) if s[i:i+len(p)]==p]"),
442:('returns all distinct values, including singletons',"result=sorted(set(args[0]))"),
}

OUTPUT_LIMIT={345:512,1047:128,1209:128,2390:128,238:2048,338:512,739:1024,977:128,1720:128,2433:1024,438:256,442:512}

def result_kind(pid):return 'string' if pid in STRING_IDS else 'integer-set' if pid in INT_SET_IDS else 'string-set' if pid in STRING_SET_IDS else 'integer-array'

def result_text(kind,result):
 if kind=='string':return result+'\n'
 if kind=='string-set':return str(len(result))+'\n'+''.join(s+'\n' for s in result)
 return str(len(result))+'\n'+(' '.join(map(str,result))+'\n' if result else '')

def make(pid):
 zh,en,desc,eng=META[pid];iz,ie=INPUT[pid];kind=result_kind(pid);name,body=WRONG[pid]
 oz='输出原始结果字符串和换行，不加引号；空串输出一个空行。' if kind=='string' else '第一行输出元素数量，随后每行一个字符串；顺序任意，不得重复；数量为0时仅输出第一行。' if kind=='string-set' else '第一行输出元素数量，随后用空白分隔所有整数，'+('按规定顺序输出并保留重复值。' if kind=='integer-array' else '顺序任意，每个值仅输出一次。')
 oe='Print the raw result string followed by a newline, without quotes; print a blank line for an empty string.' if kind=='string' else 'Print the count on the first line, then one string per line, in any order without duplicates. A zero count needs only its first line.' if kind=='string-set' else 'Print the count on the first line, then all integers separated by whitespace, '+('in the required order, preserving duplicates.' if kind=='integer-array' else 'in any order without duplicate values.')
 emit="print(result)" if kind=='string' else "print(len(result));print('\\n'.join(result)) if result else None" if kind=='string-set' else "print(len(result));print(' '.join(map(str,result))) if result else None"
 return dict(method=METHODS[pid],titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='中等' if pid in {12,71,151,179,1209,2390,238,739,763,17,22,260,438,442} else '简单',resultKind=kind,outputLimit=OUTPUT_LIMIT.get(pid,64),edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),validate=lambda a:validate(pid,a),mutants=[dict(name=name,source='import sys, math, itertools, collections, re\n'+parse(pid)+'\n'+body+'\n'+emit+'\n')])

PROBLEMS={pid:make(pid) for pid in IDS}
PROBLEMS[238]['pressure'].append(([[2]*30+[1]*99970],[2**29]*30+[2**30]*99970))
PROBLEMS[1720]['pressure'].append(([[0]*9999,100000],[100000]*10000))
PROBLEMS[2433]['pressure'].append(([[0,1000000]*50000],[0]+[1000000]*99999))
