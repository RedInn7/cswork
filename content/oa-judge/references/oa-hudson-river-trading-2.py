def kmp_events(signs, pattern, delta, amount):
 m=len(pattern); pi=[0]*m
 for i in range(1,m):
  j=pi[i-1]
  while j and pattern[i]!=pattern[j]: j=pi[j-1]
  if pattern[i]==pattern[j]: j+=1
  pi[i]=j
 j=0
 for sign,price_index in signs:
  while j and sign!=pattern[j]: j=pi[j-1]
  if sign==pattern[j]: j+=1
  if j==m: delta[price_index]+=amount; j=pi[j-1]
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); b=next(it); s=next(it)
 p=[next(it) for _ in range(n)]; buy=[next(it) for _ in range(b)]; sell=[next(it) for _ in range(s)]
 signs=[(1 if p[i]>p[i-1] else -1,i) for i in range(1,n) if p[i]!=p[i-1]]
 delta=[0]*n; kmp_events(signs,buy,delta,1)
 kmp_events(signs,sell,delta,-1)
 pos=0; out=[]
 for x in delta: pos+=x; out.append(str(pos))
 return " ".join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
