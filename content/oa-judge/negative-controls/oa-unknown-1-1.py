import sys
def solve(raw):
 d=list(map(int,raw.split()));k,n=d[:2];g=[[] for _ in range(n)]
 for a,b in zip(d[2::2],d[3::2]):g[a-1].append(b-1);g[b-1].append(a-1)
 ans=k
 for v in g:ans=ans*max(0,k-1)%1000000007
 return str(ans)
if __name__=='__main__':print(solve(sys.stdin.read()))
