import sys
def solve(raw):
    x,y,a,b=map(int,raw.split())
    while a>=x and b>=y and (a,b)!=(x,y):
      if a>b: b-=a
      else: a-=b
    return 'Yes' if (a,b)==(x,y) else 'No'

print(solve(sys.stdin.read()))
