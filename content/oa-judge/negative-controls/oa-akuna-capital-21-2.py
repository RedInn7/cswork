import sys

def solve(raw):
    values=list(map(int,raw.split()))
    take=0
    skip=-10**30
    for rating in values[1:]:
        take,skip=max(take,skip)+rating,take
    return str(take)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
