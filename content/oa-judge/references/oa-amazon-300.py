def solve(d):
    a=list(map(int,d[1:]));answer=a[0]
    for previous,current in zip(a,a[1:]):answer+=max(0,current-previous)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
