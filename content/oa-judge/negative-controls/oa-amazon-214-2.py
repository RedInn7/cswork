def solve(d):
    a=list(map(int,d[1:]));answer=0
    for right in range(len(a)):
        limit=a[right]+1;total=0
        for left in range(right,-1,-1):
            limit=a[left] if a[left]<limit else 0
            if limit<=0:break
            total+=limit
        answer=max(answer,total)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
