def solve(data):
    a=list(map(int,data[1:]));n=len(a);suffix=a.copy()
    for i in range(n-2,-1,-1):suffix[i]=min(suffix[i],suffix[i+1])
    largest=a[0];answer=0
    for i in range(n-1):
        largest=max(largest,a[i])
        if largest<suffix[i+1]:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
