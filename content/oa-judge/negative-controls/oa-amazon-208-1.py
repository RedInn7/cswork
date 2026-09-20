def solve(d):
    n=int(d[0]);reliability=list(map(int,d[1:1+n]));availability=list(map(int,d[1+n:]));total=answer=0
    for value,r in sorted(zip(availability,reliability),reverse=True):total+=r;answer=max(answer,value*total%1000000007)
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
