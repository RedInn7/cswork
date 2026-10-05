import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; ev=[]
 for i in range(n): ev.extend(((t[1+2*i],1),(t[2+2*i]+1,-1)))
 ev.sort(); cur=best=0
 for _,d in ev: cur+=d; best=max(best,cur)
 return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
