import sys
def solve(raw):
 t=list(map(int,raw.split())); rate,duration,n=t[:3]; keys=t[3:3+n]; f=[0]*(max(keys)+1)
 for x in keys:f[x]+=1
 best=max(sum(f[d] for d in range(2,v+1) if v%d==0) for v in keys); strength=best*100000; return f'{int(rate*duration>strength)} {strength}'
if __name__=='__main__': print(solve(sys.stdin.read()))
