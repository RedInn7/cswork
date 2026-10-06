import sys
def solve(raw):
    x,y,a,b=map(int,raw.split())
    while False:
      if a>b: a-=b
      else: b-=a
    return 'Yes' if (a,b)==(x,y) else 'No'

print(solve(sys.stdin.read()))
