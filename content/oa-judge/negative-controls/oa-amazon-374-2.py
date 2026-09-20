def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];m=d[n+1];b=d[n+2:];best=None;answer=None
    for j,value in enumerate(b[:n]):
        if 0<=j-1<n:best=a[j-1] if best is None else min(best,a[j-1])
        if best is not None:answer=best+value if answer is None else min(answer,best+value)
    return str(-1 if answer is None else answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
