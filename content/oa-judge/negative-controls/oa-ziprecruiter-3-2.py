def solve(raw):
 p=raw.split(); n=int(p[0]); best=''; score=-1
 for i in range(n):
  name=p[1+2*i]; grade=int(p[2+2*i])
  if grade>=score: best=name; score=grade
 return best

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
