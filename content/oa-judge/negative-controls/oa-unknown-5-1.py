import sys
def solve(raw):
 l=raw.splitlines();n,m=map(int,l[0].split());ans=[0]*n;st=[];p=0
 for x in l[1:]:
  i,k,t=x.split(':');i=int(i);t=int(t)
  if k=='start':st.append((i,t))
  else:
   j,s=st.pop();ans[j]+=t-s+1
   if st:st[-1]=(st[-1][0],t+1)
 return ' '.join(map(str,ans))
if __name__=='__main__':print(solve(sys.stdin.read()))
