import sys
def solve(raw):
 l=raw.splitlines();n,m=map(int,l[0].split());ans=[0]*n;st=[];p=0
 for x in l[1:]:
  i,k,t=x.split(':');i=int(i);t=int(t)
  if st:ans[st[-1]]+=t-p
  if k=='start':st.append(i);p=t
  else:st.pop();p=t
 return ' '.join(map(str,ans))
if __name__=='__main__':print(solve(sys.stdin.read()))
