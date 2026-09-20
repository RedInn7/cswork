def solve(d):
    a=list(map(int,d[1:]));total=sum(a);prefix=0;answer=-10**30
    for v in a:
        answer=max(answer,total-prefix);prefix+=v;answer=max(answer,prefix)
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
