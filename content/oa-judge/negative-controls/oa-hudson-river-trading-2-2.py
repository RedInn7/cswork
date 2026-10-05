def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); b=next(it); s=next(it)
 p=[next(it) for _ in range(n)]; buy=[next(it) for _ in range(b)]; sell=[next(it) for _ in range(s)]
 stream=[(1 if p[i]>p[i-1] else -1,i) for i in range(1,n) if p[i]!=p[i-1]]
 d=[0]*n
 for pat,sign in ((buy,1),(sell,-1)):
  for j in range(len(pat)-1,len(stream)):
   if [x for x,_ in stream[j-len(pat)+1:j+1]]==pat: d[min(stream[j][1]+1,n-1)]+=sign
 pos=0; out=[]
 for x in d: pos+=x; out.append(str(pos))
 return " ".join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
