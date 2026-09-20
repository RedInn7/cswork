def solve(d):
    a=sorted(map(int,d[1:]));current=0
    for v in a:current=min(v,current+1)
    return str(current)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
