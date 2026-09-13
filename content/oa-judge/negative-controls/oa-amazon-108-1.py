def solve(d):
    import heapq
    a=list(map(int,d[1:]));n=len(a);heap=[]
    for day in range(1,(n+1)//2+1):
        heapq.heappush(heap,max(a[day-1],a[n-day]))
        if day-1!=n-day:heapq.heappush(heap,a[n-day])
        while len(heap)>day:heapq.heappop(heap)
    return str(sum(heap))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
