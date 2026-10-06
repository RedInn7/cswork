def solve(raw):
 v=list(map(int,raw.split()));a=v[1:v[0]+1];n=len(a);L=[-1]*n;R=[n]*n;st=[]
 for i,x in enumerate(a):
  while st and a[st[-1]]<=x:st.pop()
  if st:L[i]=st[-1]
  st.append(i)
 st=[]
 for i in range(n-1,-1,-1):
  while st and a[st[-1]]<=a[i]:st.pop()
  if st:R[i]=st[-1]
  st.append(i)
 return str(sum(R[i]-L[i]-1 for i in range(n)))

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
