def solve(d):
    n=int(d[0]);answer=0
    for a,b in zip(d[1:n+1],d[n+1:]):
        answer+=abs(int(a)-int(b))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
