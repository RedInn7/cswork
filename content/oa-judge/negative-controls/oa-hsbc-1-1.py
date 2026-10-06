import sys
def solve(raw):
    a=list(map(int,raw.split())); n=a[0]; v=a[1:1+n]; k=a[1+n]
    return ' '.join(map(str,sorted(v[:k])+sorted(v[k:])))

print(solve(sys.stdin.read()))
