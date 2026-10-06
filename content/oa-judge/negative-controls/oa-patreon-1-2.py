def solve(raw):
 v=list(map(int,raw.split()));cur=set(v[1:v[0]+1]);ans=0
 while True:
  e=[x for x in cur if x%2==0]
  if not e:return str(ans)
  x=max(e);cur.remove(x);cur.add(x//2);ans+=v[1:v[0]+1].count(x)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
