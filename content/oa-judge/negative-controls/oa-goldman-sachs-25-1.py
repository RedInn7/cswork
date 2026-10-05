import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];s=mn=0
 for x in t[1:1+n]:s+=x;mn=min(mn,s)
 return str(-mn)
if __name__=='__main__':print(solve(sys.stdin.read()))
