#!/usr/bin/env python3
"""Roblox #7 longest 1,2,0,2,0... diagonal segment ending at the border; rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-roblox-7';BATCH='roblox-7-recovered';SEED=20261008007
PATH='fastprep/Roblox/roblox-find-longest-diagonal-segment.md'
RM=500
DIRS=[(-1,-1),(-1,1),(1,-1),(1,1)]
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int R,C;if(scanf("%d %d",&R,&C)!=2)return 0;vector<int>a(R*C);for(auto&x:a)scanf("%d",&x);
int best=0;int dr[4]={-1,-1,1,1},dc[4]={-1,1,-1,1};
vector<int>len2(R*C),len0(R*C); // length of a valid tail starting here with expected value 2 / 0, reaching the border; 0 if invalid
for(int d=0;d<4;d++){
 int r0=dr[d]<0?0:R-1,r1=dr[d]<0?R:-1,rs=dr[d]<0?1:-1;int c0=dc[d]<0?0:C-1,c1=dc[d]<0?C:-1,cs=dc[d]<0?1:-1;
 for(int r=r0;r!=r1;r+=rs)for(int c=c0;c!=c1;c+=cs){int nr=r+dr[d],nc=c+dc[d];bool out=nr<0||nr>=R||nc<0||nc>=C;int i=r*C+c,j=out?-1:nr*C+nc;
  len2[i]=a[i]!=2?0:out?1:(len0[j]?len0[j]+1:0);
  len0[i]=a[i]!=0?0:out?1:(len2[j]?len2[j]+1:0);
  if(a[i]==1){int L=out?1:(len2[j]?len2[j]+1:0);best=max(best,L);}}}
printf("%d\n",best);}
'''
def brute_cpp(body):
 return r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int R,C;scanf("%d %d",&R,&C);vector<vector<int>>a(R,vector<int>(C));for(auto&row:a)for(auto&x:row)scanf("%d",&x);
int best=0;int dr[4]={-1,-1,1,1},dc[4]={-1,1,-1,1};
'''+body+'''printf("%d\\n",best);}
'''
MUTANTS=[
 {'name':'错误不要求终点在边界','language':'cpp','code':brute_cpp('''for(int r=0;r<R;r++)for(int c=0;c<C;c++)if(a[r][c]==1)for(int d=0;d<4;d++){int k=1,rr=r+dr[d],cc=c+dc[d];
 while(rr>=0&&rr<R&&cc>=0&&cc<C&&a[rr][cc]==(k%2?2:0)){k++;rr+=dr[d];cc+=dc[d];}best=max(best,k);}
''')},
 {'name':'错误只考虑向右下和右上','language':'cpp','code':REFERENCE.replace('for(int d=0;d<4;d++){','for(int d=1;d<4;d+=2){')},
 {'name':'错误模式写成1,0,2,0,2','language':'cpp','code':REFERENCE.replace('if(a[i]==1){int L=out?1:(len2[j]?len2[j]+1:0);','if(a[i]==1){int L=out?1:(len0[j]?len0[j]+1:0);')},
 {'name':'错误按行列方向而非对角线','language':'cpp','code':REFERENCE.replace('int dr[4]={-1,-1,1,1},dc[4]={-1,1,-1,1};','int dr[4]={-1,1,0,0},dc[4]={0,0,-1,1};')},
]
EDITORIAL='''## 题意

矩阵元素只有0、1、2。找一条沿对角线方向的线段：第一个元素是1，之后依次为2,0,2,0,…；可以从任意位置出发，沿4个对角方向之一前进，并且必须结束在第一行、最后一行、第一列或最后一列的元素上。求最长长度。数据保证存在长度至少为2的这种线段。

## 思路

沿对角方向前进时，坐标的行和列同时变化，所以除了起点外，线段第一次碰到边界就是走出矩阵前的最后一个格子。因此“结束在边界”等价于：从起点出发沿该方向直到出界，途经的全部格子都符合模式。

对每个方向，从该方向的出口一侧往回递推：len2[x]表示从x出发、期望值为2、一直符合模式走到出界的长度（不合法为0），len0同理。len2[x]= (x是2) 且 (下一格出界则为1，否则需len0[下一格]>0，取其+1)。值为1的格子在该方向的答案就是1+len2[下一格]（下一格出界时为1）。

## 正确性

递推顺序保证下一格先算出；len2/len0精确刻画“从这里到出界都匹配模式”。取所有起点与方向的最大值即为答案。

## 复杂度

O(4RC)。

## 独立验证

oracle对每个1和每个方向逐格行走到出界、逐格比对模式（O(RC·min(R,C))），不使用递推数组。穷举2×2矩阵的全部3^4种取值和2×3、3×2中满足保证条件的矩阵并逐个真实运行参考程序。错误解覆盖不要求到达边界、只考虑两个方向、模式写反和误用横竖方向。
'''
def encode(m):
 R=len(m);C=len(m[0]);assert 1<=R<=RM and 1<=C<=RM and all(len(r)==C and set(r)<={0,1,2} for r in m)
 assert oracle(m)>=2
 return f'{R} {C}\n'+''.join(' '.join(map(str,r))+'\n' for r in m)
def oracle(m):
 R=len(m);C=len(m[0]);best=0
 for r in range(R):
  for c in range(C):
   if m[r][c]!=1:continue
   for dr,dc in DIRS:
    k=1;rr,cc=r+dr,c+dc;ok=True
    while 0<=rr<R and 0<=cc<C:
     if m[rr][cc]!=(2 if k%2 else 0):ok=False;break
     k+=1;rr+=dr;cc+=dc
    if ok:best=max(best,k)
 return best
def plant(m,rng,length=None):
 R=len(m);C=len(m[0])
 while True:
  dr,dc=rng.choice(DIRS);r=rng.randrange(R);c=rng.randrange(C)
  cells=[];rr,cc=r,c
  while 0<=rr<R and 0<=cc<C:cells.append((rr,cc));rr+=dr;cc+=dc
  if len(cells)<2:continue
  if length:cells=cells[-length:] if len(cells)>=length else cells
  for k,(rr,cc) in enumerate(cells):m[rr][cc]=1 if k==0 else (2 if k%2 else 0)
  return m
def main():
 rng=random.Random(SEED)
 ex=[[0,0,1,2],[0,2,2,2],[2,1,0,1]]
 assert oracle(ex)==3
 small=[ex,[[1,2],[0,0]],[[1,0],[0,2]],[[0,1,0],[2,0,2],[1,2,0]],[[1,1],[1,2]]]
 small=[m for m in small if oracle(m)>=2]
 keys={encode(m) for m in small}
 while len(small)<170:
  R=rng.randint(2,7);C=rng.randint(2,7);m=[[rng.choice([0,1,2]) for _ in range(C)] for _ in range(R)]
  if oracle(m)<2:plant(m,rng)
  k=encode(m)
  if k not in keys:keys.add(k);small.append(m)
 oracles=[{'input':encode(m),'expectedOutput':f'{oracle(m)}\n'} for m in small]
 cases=[]
 def add(nm,m,hidden=True,closed=None):
  e=oracle(m)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(m),f'{e}\n',hidden))
 add('样例1',ex,False,3);add('两格线段',[[1,0],[0,2]],False,2);add('中途不匹配',[[2,0,0],[0,2,0],[0,0,1],[2,2,2]],False,2)
 used={c['input'] for c in cases};rest=[m for m in small if encode(m) not in used]
 for i,m in enumerate(rest[:26]):add(f'小规模{i+1}',m)
 def full(R,C,fill):return [[fill(r,c) for c in range(C)] for r in range(R)]
 big=RM
 add('满规模主对角线完整模式',full(big,big,lambda r,c:(1 if r==c==0 else 2 if r==c and r%2 else 0 if r==c else 1)),closed=big)
 m=full(big,big,lambda r,c:rng.choice([0,1,2]));plant(m,rng);add('满规模随机',m)
 m=full(big,big,lambda r,c:2 if (r+c)%2 else 0)
 for r in range(0,big,7):m[r][(r*3)%big]=1
 plant(m,rng);add('满规模棋盘加若干1',m)
 m=full(big,big,lambda r,c:2 if r%2 else 0);plant(m,rng);add('满规模横条纹',m)
 m=full(big,big,lambda r,c:0);plant(m,rng,big);add('满规模单条最长线段',m)
 m=full(big,big,lambda r,c:2);m[1][1]=1;add('满规模两格线段',m,closed=2)
 m=full(2,big,lambda r,c:rng.choice([0,1,2]));plant(m,rng);add('满规模两行',m)
 m=full(big,3,lambda r,c:rng.choice([1,2,0]));plant(m,rng);add('满规模三列',m)
 def exhaustive(run):
  c=0
  for R,C in ((2,2),(2,3),(3,2)):
   for vals in product((0,1,2),repeat=R*C):
    m=[list(vals[i*C:(i+1)*C]) for i in range(R)]
    e=oracle(m)
    if e<2:continue
    assert run(encode(m)).split()==[str(e)];c+=1
  return c,{'shapes':['2x2','2x3','3x2'],'values':[0,1,2],'onlyWithAnswerAtLeast2':True}
 P=problem(PID,'Roblox OA #7：最长对角线段','中等',['矩阵','动态规划','模拟'],
  '给定一个R行C列的矩阵，每个元素为0、1或2。求满足下列模式的最长对角线段：1, 2, 0, 2, 0, 2, 0, …（第一个元素是1，之后2和0交替无限重复），并且该线段在矩阵边界处结束。输出这个线段的长度。\n\n线段可以从矩阵的任意元素开始，可以沿四个对角方向中的任意一个前进，并且必须结束在第一行、最后一行、第一列或最后一列的元素上。数据保证至少存在一条长度不小于2的这种线段。',
  '第一行R和C；随后R行，每行C个整数（0、1或2）。1≤R,C≤500。',
  '输出一个整数，表示最长线段的长度。',
  '样例1：从第3行第4列（从1开始）的1出发向左上走，经过2、0，到达第1行，线段[1,2,0]长度为3。\n样例2：从左上角的1向右下走到2，长度2。\n样例3：第3行第3列（从1开始）的1向左上依次是2、2，第二个不是0，不成立；向左下走到最后一行的2，长度为2。',
  ['沿对角线走时，除起点外第一次碰到边界就是最后一个格子。','因此线段必须从起点一直匹配到走出矩阵。','对每个方向从出口一侧递推“到出界为止都匹配”的长度。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'对角方向反向递推合法尾段','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent per-start, per-direction walk to the matrix exit with cell-by-cell pattern comparison; exhaustive 2x2/2x3/3x2 matrices with answer>=2.',
  'imageProvenance':IMAGE_PROVENANCE+' original-0 is the original CodeSignal statement photo (pattern, start anywhere, any diagonal direction, must end at first/last row or column, example); original-1 is a FastPrep rendering whose explanation is the page author guess and is not used.',
  'rangeDisclosure':'Source images give no constraints (TO-DO). Chosen: 1<=R,C<=500, values 0/1/2. The images do not say what to return when no segment exists or whether a lone border 1 counts; inputs guarantee a valid segment of length>=2, so both questions never affect the answer. Stdin: "R C" then the matrix.',
  'corrections':['Upstream md explanation (start at 1-based (2,1) going up-right) is an acknowledged guess; that cell is 0. The valid segment starts at 1-based (3,4) going up-left. Output 3 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出模式、任意起点、四个对角方向和必须结束在边界；无解与单格线段未说明，数据保证存在长度≥2的线段；原图无约束，自选R、C≤500；方向递推，独立逐格行走与小矩阵穷举核验。'})
if __name__=='__main__':main()
