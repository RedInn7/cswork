def solve(d):
    n,k=map(int,d[:2]);previous=0
    for v in sorted(map(int,d[2:])):
        gap=v-previous-1
        if k<=gap:return str(previous+k)
        k-=gap;previous=v
    return str(previous+k)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
