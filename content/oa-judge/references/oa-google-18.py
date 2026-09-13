def solve(data):
    import bisect
    n,m=map(int,data[:2]); houses=list(map(int,data[2:2+n])); stores=sorted(map(int,data[2+n:])); result=[]
    for house in houses:
        index=bisect.bisect_left(stores,house); candidates=[]
        if index<m:candidates.append(stores[index])
        if index>0:candidates.append(stores[index-1])
        result.append(str(min(candidates,key=lambda s:(abs(s-house),s))))
    return ' '.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
