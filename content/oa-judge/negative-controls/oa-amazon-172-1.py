def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));b=sorted(map(int,d[n+1:]));return str(sum(abs(x-y) for x,y in zip(a,b)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
