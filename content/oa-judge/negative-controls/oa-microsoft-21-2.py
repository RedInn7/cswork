def solve(d):
    a=list(map(int,d[1:]));n=len(a);rank=(n*(n+1)//2+1)//2;lo=1;hi=len(set(a))
    while lo<hi:
        k=(lo+hi)//2;counts={};left=total=0
        for right,value in enumerate(a):
            counts[value]=counts.get(value,0)+1
            while len(counts)>k:
                old=a[left];counts[old]-=1;left+=1
                if counts[old]==0:del counts[old]
            total+=right-left+1
        if total>=rank:hi=k
        else:lo=k+1
    return str(len(set(a)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
