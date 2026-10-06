# 顺时针旋转误写成逆时针
import sys
def solve(raw):
 t=raw.split();it=iter(t);r,c=int(next(it)),int(next(it));a=[[int(next(it)) for _ in range(c)] for _ in range(r)];q=int(next(it))
 for _ in range(q):
  op=next(it)
  if op=='swapRows':
   x,y=int(next(it)),int(next(it));a[x],a[y]=a[y],a[x]
  elif op=='swapColumns':
   x,y=int(next(it)),int(next(it))
   for row in a:row[x],row[y]=row[y],row[x]
  elif op=='reverseRow':a[int(next(it))].reverse()
  elif op=='reverseColumn':
   x=int(next(it))
   for i in range(len(a)//2):a[i][x],a[-i-1][x]=a[-i-1][x],a[i][x]
  else:a=[list(row) for row in zip(*a)]
 return '\n'.join(' '.join(map(str,row)) for row in a)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
