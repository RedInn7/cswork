def solve(d):
    a=list(map(int,d[1:]));before2=[0]*4;before=[0]*4
    for i,value in enumerate(a):
        current=before.copy()
        if i:
            for k in range(1,4):current[k]=max(before[k],before[k-1]+a[i-1]+value)
        before2,before=before,current
    return str(before[3])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
