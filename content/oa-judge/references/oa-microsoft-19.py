def solve(d):
    a=sorted(map(int,d[1:]));answer=max(1,a[-1]-a[0])
    for i in range(1,len(a)):answer=min(answer,max(1,a[i-1]-a[0],a[-1]-a[i]))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
