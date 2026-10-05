import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; ev=[]
 for i in range(n): ev.extend(((t[1+2*i],1),(t[2+2*i]+1,-1)))
 ev.sort(); c=b=0
 for _,d in ev:c+=d;b=max(b,c)
 return str(max(1,b-1))
if __name__=='__main__':print(solve(sys.stdin.read()))
