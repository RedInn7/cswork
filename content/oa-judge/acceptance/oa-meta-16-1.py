def solve(data):
    n,target=map(int,data[:2]); a=list(map(int,data[2:])); left=0; right=n-1; distance=None; answer=(a[0],a[-1])
    while left<right:
        total=a[left]+a[right]; delta=abs(total-target)
        if distance is None or delta<=distance:distance=delta; answer=(a[left],a[right])
        if total<target:left+=1
        else:right-=1
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
