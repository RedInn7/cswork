import sys
def solve(raw):
 lines=raw.splitlines();n,m=map(int,lines[0].split());ans=[0]*n;stack=[];prev=0
 for line in lines[1:1+m]:
  fid,kind,t=line.split(':');fid=int(fid);t=int(t)
  if stack:ans[stack[-1]]+=t-prev
  if kind=='start':stack.append(fid);prev=t
  else:ans[fid]+=1;stack.pop();prev=t+1
 return ' '.join(map(str,ans))
if __name__=='__main__': print(solve(sys.stdin.read()))
