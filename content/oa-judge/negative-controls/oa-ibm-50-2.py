def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));low=0;high=a[-1]-a[0]
    while low<high:
        mid=(low+high+1)//2;count=0;last=a[0]
        for v in a[1:]:
            if v-last>=mid:count+=1;last=v
        if count>=k:low=mid
        else:high=mid-1
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
