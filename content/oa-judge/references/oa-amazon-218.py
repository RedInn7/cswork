def solve(d):
    a=list(map(int,d[1:]));x=0
    for v in a:x^=v
    return str(0 if not any(a) else 1 if x==0 else 2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
