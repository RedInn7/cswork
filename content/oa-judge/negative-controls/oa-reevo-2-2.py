import sys
def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; p=v[1:1+n]; out=[]
 for k in range(1,n+1): out.append('1' if max(p[:k])==k and min(p[:k])==1 else '0')
 return ''.join(out)
if __name__ == "__main__": print(solve(sys.stdin.read()))
