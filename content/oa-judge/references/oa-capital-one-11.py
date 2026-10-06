import sys
def solve(raw):
 t=list(map(int,raw.split()));n,m=t[:2];i=2;b=t[i];i+=1;obs=set()
 for _ in range(b):obs.add((t[i],t[i+1]));i+=2
 k=t[i];i+=1;tele={}
 for _ in range(k):tele[(t[i],t[i+1])]=(t[i+2],t[i+3]);i+=4
 p=(0,0);steps=1;seen=set()
 while True:
  if p in seen:return '-2'
  seen.add(p)
  if p in tele:p=tele[p];steps+=1;continue
  if p==(n-1,m-1):return str(steps)
  r,c=p;right=(r,c+1);down=(r+1,c)
  if c+1<m and right not in obs:p=right
  elif r+1<n and down not in obs:p=down
  else:return '-1'
  steps+=1

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
