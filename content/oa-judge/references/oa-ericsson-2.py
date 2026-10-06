def solve(raw):
 v=list(map(int,raw.split()));n,k=v[:2];c={}
 for x in v[2:n+2]:c[x]=c.get(x,0)+1
 return ' '.join(map(str,sorted(c,key=lambda x:(-c[x],x))[:k]))

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
