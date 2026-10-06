def solve(raw):
 v=list(map(int,raw.split()));n,m=v[:2];a=v[2:2+n];lo=min(v[2+n+2*i] for i in range(m));hi=max(v[3+n+2*i] for i in range(m))
 return str(sum(lo<=x<=hi for x in a))

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
