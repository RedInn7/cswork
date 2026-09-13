def solve(d):
    n=int(d[0]);p=list(map(int,d[1:]));total=sum(p)//(n-1)
    return ' '.join(str(v-total) for v in p)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
