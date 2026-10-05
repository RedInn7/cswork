def match(a,p):
 return len(a)>=len(p) and a[-len(p):]==p
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); b=next(it); s=next(it)
 prices=[next(it) for _ in range(n)]; buy=[next(it) for _ in range(b)]; sell=[next(it) for _ in range(s)]
 signs=[(1 if prices[i]>prices[i-1] else -1 if prices[i]<prices[i-1] else 0,i) for i in range(1,n)]
 stream=[]; delta=[0]*n
 for sign,idx in signs:
  stream.append(sign)
  if match(stream,buy): delta[idx]+=1
  if match(stream,sell): delta[idx]-=1
 pos=0; out=[]
 for d in delta: pos+=d; out.append(str(pos))
 return " ".join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
