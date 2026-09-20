def solve(d):
    a=list(map(int,d[1:]));total=sum(a);prefix=0;answer=0
    for v in a:
        answer=max(answer,total-prefix);prefix+=v;answer=max(answer,prefix)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
