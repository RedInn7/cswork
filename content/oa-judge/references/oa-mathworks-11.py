def solve(s):
 it=iter(map(int,s.split()));n=next(it);k=next(it);a=[next(it) for _ in range(n)];b=[next(it) for _ in range(n)]
 return str(sum(b)+sum(sorted((x-y for x,y in zip(a,b)),reverse=True)[:k]))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
