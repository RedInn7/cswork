#!/usr/bin/env python3
"""DRW #1 simplified Tetris engine; piece shapes and line semantics recovered from the source images."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-drw-1';BATCH='drw-1-recovered';SEED=20261008901
PATH='fastprep/DRW/drw-simplified-tetris-engine.md'
W=10;HMAX=100;LINES=200;PIECES=1000
SHAPES={'Q':[(0,0),(1,0),(0,1),(1,1)],'Z':[(1,0),(2,0),(0,1),(1,1)],'S':[(0,0),(1,0),(1,1),(2,1)],'T':[(1,0),(0,1),(1,1),(2,1)],'I':[(0,0),(1,0),(2,0),(3,0)],'L':[(0,0),(1,0),(0,1),(0,2)],'J':[(0,0),(1,0),(1,1),(1,2)]}
WIDTH={k:max(x for x,_ in v)+1 for k,v in SHAPES.items()}
REFERENCE=r'''#include <cstdio>
#include <cstring>
#include <vector>
#include <string>
#include <iostream>
using namespace std;
int main(){ios::sync_with_stdio(false);
int sx[7][4]={{0,1,0,1},{1,2,0,1},{0,1,1,2},{1,0,1,2},{0,1,2,3},{0,1,0,0},{0,1,1,1}};
int sy[7][4]={{0,0,1,1},{0,0,1,1},{0,0,1,1},{0,1,1,1},{0,0,0,0},{0,0,1,2},{0,0,1,2}};
const char*names="QZSTILJ";string line,out;
while(getline(cin,line)){if(!line.empty()&&line.back()=='\r')line.pop_back();if(line.empty())continue;
 vector<int>rows;size_t p=0;
 while(p<line.size()){int t=strchr(names,line[p])-names;int c=line[p+1]-'0';p+=2;if(p<line.size()&&line[p]==',')p++;
  int H=rows.size();int y=0;
  for(int k=0;k<4;k++){int col=c+sx[t][k];int top=0;for(int r=H-1;r>=0;r--)if(rows[r]>>col&1){top=r+1;break;}y=max(y,top-sy[t][k]);}
  for(int k=0;k<4;k++){int r=y+sy[t][k];while((int)rows.size()<=r)rows.push_back(0);rows[r]|=1<<(c+sx[t][k]);}
  vector<int>keep;for(int r:rows)if(r!=1023)keep.push_back(r);rows=keep;
  while(!rows.empty()&&rows.back()==0)rows.pop_back();}
 out+=to_string(rows.size());out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误S与Z形状对调','language':'cpp','code':REFERENCE.replace('int sx[7][4]={{0,1,0,1},{1,2,0,1},{0,1,1,2},','int sx[7][4]={{0,1,0,1},{0,1,1,2},{1,2,0,1},')},
 {'name':'错误方块可以落入下方空洞','language':'cpp','code':REFERENCE.replace('int H=rows.size();int y=0;\n  for(int k=0;k<4;k++){int col=c+sx[t][k];int top=0;for(int r=H-1;r>=0;r--)if(rows[r]>>col&1){top=r+1;break;}y=max(y,top-sy[t][k]);}','int H=rows.size();int y=0;\n  for(;;y++){bool ok=true;for(int k=0;k<4;k++){int r=y+sy[t][k];if(r<H&&(rows[r]>>(c+sx[t][k])&1))ok=false;}if(ok)break;}')},
 {'name':'错误不消除满行','language':'cpp','code':REFERENCE.replace('if(r!=1023)keep.push_back(r);','keep.push_back(r);')},
 {'name':'错误消行后方块逐列下落填补空隙','language':'cpp','code':REFERENCE.replace('vector<int>keep;for(int r:rows)if(r!=1023)keep.push_back(r);rows=keep;','{bool cl=false;vector<int>keep;for(int r:rows)if(r!=1023)keep.push_back(r);else cl=true;rows=keep;if(cl){vector<int>cnt(10,0);for(int r:rows)for(int b=0;b<10;b++)cnt[b]+=r>>b&1;for(auto&r:rows)r=0;for(int b=0;b<10;b++)for(int i=0;i<cnt[b];i++)rows[i]|=1<<b;}}')},
]
EDITORIAL='''## 题意

宽10列的简化俄罗斯方块。方块从上方落下，任何部分碰到底部或已停住的方块就停下；方块是刚体，不旋转，形状固定（Q、Z、S、T、I、L、J）。整行填满就消除，上面的各行整体下移，行内图案不变，不会填补下面的空洞。每行输入是一个放置序列，从空盘面开始，输出最终剩余方块的高度。

## 思路

用每行一个10位二进制数表示盘面。放置方块时，方块从顶上一直下落，所以只受各列“最高的已占格子”阻挡：对方块的每个格子(dx,dy)，所在列最高占用行为top，则方块底部至少在top−dy；取最大值即落点。写入四个格子后，删除所有等于全1的行（其余行按原顺序下移），再去掉顶部的空行。最终行数就是高度。

## 正确性

方块自上而下竖直移动，途中只可能被每列最上方的方块挡住，下方空洞到达不了，所以落点由各列顶部高度决定。消行只删除满行并保持其余行的相对顺序和行内图案，与题意“按行下落、不填补空洞”一致。

## 复杂度

每个方块O(4·H+H)，H≤100。

## 独立验证

oracle用Python逐格模拟方块从高处一格一格下落、碰撞即停，并以集合存储占用格子，不使用列顶高度公式。穷举全部1..2个方块的放置序列（所有方块、所有合法列）作为一组多行输入，并加随机长序列，逐个真实运行参考程序。错误解覆盖S/Z形状对调、方块穿过上方落入空洞、不消行、消行后逐列填补空隙。
'''
def encode(lines):
 assert 1<=len(lines)<=LINES
 for ln in lines:
  assert 1<=len(ln)<=PIECES and all(p[0] in SHAPES and 0<=p[1]<=W-WIDTH[p[0]] for p in ln)
  assert simulate(ln)[1]<=HMAX
 return ''.join(','.join(f'{a}{b}' for a,b in ln)+'\n' for ln in lines)
def step(cells,p):
 """drop one piece cell by cell from above the stack; returns (new cells, height before clearing)"""
 t,c=p;sh=[(c+dx,dy) for dx,dy in SHAPES[t]];y=max([yy for _,yy in cells],default=-1)+5
 while y>0 and not any((x,y-1+dy) in cells for x,dy in sh):y-=1
 cells=cells|{(x,y+dy) for x,dy in sh};peak=max(yy for _,yy in cells)+1
 full=sorted({yy for _,yy in cells if all((x,yy) in cells for x in range(W))})
 if full:cells={(x,yy-sum(1 for f in full if f<yy)) for x,yy in cells if yy not in full}
 return cells,peak
def simulate(seq):
 cells=frozenset();mx=0
 for p in seq:cells,pk=step(cells,p);mx=max(mx,pk)
 return (max([y for _,y in cells],default=-1)+1,mx)
def expect(lines):return ''.join(f'{simulate(ln)[0]}\n' for ln in lines)
def parse(s):return [(p[0],int(p[1])) for p in s.split(',')]
def gen(rng,n,pick):
 seq=[];cells=frozenset();tries=0
 while len(seq)<n and tries<50*n:
  tries+=1;p=pick(len(seq));nc,pk=step(cells,p)
  if pk<=HMAX:seq.append(p);cells=nc
 return seq
def anypiece(rng):
 t=rng.choice('QZSTILJ');return (t,rng.randint(0,W-WIDTH[t]))
def randseq(rng,n):return gen(rng,n,lambda i:anypiece(rng))
def fillseq(rng,n):
 plan=[('I',0),('I',4),('Q',8),('I',0),('I',4)]
 return gen(rng,n,lambda i:plan[i%5] if rng.random()<0.8 else anypiece(rng))
def main():
 rng=random.Random(SEED)
 exs=[parse('Q0'),parse('I0,I4,Q8'),parse('T1,Z3,I4'),parse('Q0,I2,I6,I0,I6,I6,Q2,Q4')]
 assert [simulate(e)[0] for e in exs]==[2,1,4,3]
 smallsets=[exs]
 allp=[(t,c) for t in 'QZSTILJ' for c in range(W-WIDTH[t]+1)]
 for t,c in allp[:20]:smallsets.append([[(t,c)]])
 keys={encode(s) for s in smallsets}
 while len(smallsets)<170:
  s=[randseq(rng,rng.randint(1,12)) for _ in range(rng.randint(1,4))]
  s=[x for x in s if x]
  if s and encode(s) not in keys:keys.add(encode(s));smallsets.append(s)
 oracles=[{'input':encode(s),'expectedOutput':expect(s)} for s in smallsets]
 cases=[]
 def add(nm,s,hidden=True):cases.append(case(nm,encode(s),expect(s),hidden))
 add('样例1',[exs[1],exs[0]],False);add('样例2',[exs[2]],False);add('样例3',[exs[3]],False)
 used={c['input'] for c in cases};rest=[s for s in smallsets if encode(s) not in used]
 for i,s in enumerate(rest[:24]):add(f'小规模{i+1}',s)
 add('全部单块放置',[[p] for p in allp])
 add('满规模多行随机短序列',[randseq(rng,rng.randint(1,40)) for _ in range(LINES)])
 add('满规模长序列频繁消行',[fillseq(rng,PIECES) for _ in range(20)])
 add('满规模高度接近上限',[randseq(rng,PIECES) for _ in range(5)])
 add('满规模竖条L与J',[[('L',0),('J',8)]*20+[('I',1),('I',5)] for _ in range(50)])
 add('满规模交错S与Z',[gen(rng,60,lambda i:(rng.choice('SZ'),rng.randint(0,7))) for _ in range(100)])
 add('满规模T块堆叠',[gen(rng,80,lambda i:('T',rng.randint(0,7))) for _ in range(100)])
 add('满规模I与Q精确填满',[[('I',0),('I',4),('Q',8),('I',0),('I',4)]*200 for _ in range(10)])
 def exhaustive(run):
  lines=[[p] for p in allp]+[[p,q] for p in allp for q in allp]
  c=0
  for i in range(0,len(lines),LINES):
   chunk=lines[i:i+LINES];assert run(encode(chunk)).split()==expect(chunk).split();c+=len(chunk)
  return c,{'sequences':'every placement sequence of length 1 and 2 over all pieces and legal columns','linesPerRun':LINES}
 P=problem(PID,'DRW OA #1：简化俄罗斯方块','中等',['模拟','位运算'],
  '实现一个简化的俄罗斯方块引擎。网格宽10列，方块从顶部进入，像受重力一样竖直下落，只要方块的任何部分碰到网格底部或已经停住的方块就立刻停下。每个方块由4个单位方格组成，是刚体，不会旋转，两个方格不能占据同一位置。\n\n方块共7种，固定形状如下（以方块最左列为x=0、最下行为y=0给出各方格坐标(x,y)）：\nQ：(0,0)(1,0)(0,1)(1,1)\nZ：(1,0)(2,0)(0,1)(1,1)\nS：(0,0)(1,0)(1,1)(2,1)\nT：(1,0)(0,1)(1,1)(2,1)\nI：(0,0)(1,0)(2,0)(3,0)\nL：(0,0)(1,0)(0,1)(0,2)\nJ：(0,0)(1,0)(1,1)(1,2)\n\n每当某一整行被填满，该行消失，上方各行整体下移到空出的位置，行内的方块图案不变，也不会去填补下方行中的空隙。\n\n输入的每一行是一个放置序列，每一行都从空网格开始，求处理完该行全部方块后剩余方块的高度。',
  '输入若干行（直到文件结束），每行是逗号分隔的放置列表，每项为一个方块字母和一位数字，数字表示方块占据的最左列（从0开始）。输入保证合法，方块不会超出网格左右边界，过程中高度不超过100。行数不超过200，每行不超过1000个方块。',
  '对输入的每一行输出一行，为该序列结束后剩余方块的高度。',
  '样例1：第一行I0,I4,Q8：两个I铺满第0..7列，Q放在第8、9列，最底行被填满并消除，剩下Q的上半部分，高度1；第二行Q0落到底部，高度2。\n样例2：T1,Z3,I4没有满行，最终高度4。\n样例3：Q0,I2,I6后最底行消除；再放I0,I6,I6,Q2,Q4后第二行被填满并消除；行整体下落不填补空隙，最终高度3。',
  ['方块从上方竖直下落，只会被每列最高的已占格子挡住。','消行时只删除满行，其余行保持原样下移。','可以用一个10位整数表示一行。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'按列顶高度落块与整行删除','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':('满规模','全部单块'),
  'oracleMethod':'Independent Python cell-set simulation dropping each piece one row at a time from above the stack until collision, with explicit full-row deletion and per-row shift; exhaustive all 1- and 2-piece sequences batched as multi-line inputs.',
  'imageProvenance':IMAGE_PROVENANCE+' Four pages of the original DRW PDF: rules and shape diagram (page 1), STDIN/STDOUT format (page 2), worked examples 1-3 with board diagrams (pages 3-4).',
  'rangeDisclosure':'Original guarantees kept: width 10, valid input, height never exceeds 100. The original gives no line/piece counts; chosen: at most 200 lines, at most 1000 placements per line. Original multi-line stdin/stdout format kept.',
  'corrections':['Upstream md rewrote the task as a single-sequence function; the original multi-line STDIN/STDOUT format is used. The image example Q0 -> 2 is included.','Page-2 STDOUT sample (1,4,7,8,3,5,6,2) has no corresponding input and is not used.'],
  'reason':'原图给出7种方块固定形状、竖直下落与按行消除不填空隙的规则、多行标准输入输出格式和全部样例；行数与每行方块数自选上限；列顶高度落块，独立逐格下落模拟与1..2块全序列穷举核验。'})
if __name__=='__main__':main()
