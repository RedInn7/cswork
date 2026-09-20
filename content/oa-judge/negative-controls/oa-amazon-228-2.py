def solve(d):
    import heapq
    n,t=map(int,d[:2]);a=list(map(int,d[2:]))
    def valid(k):
        heap=[0]*k
        for v in a:heapq.heapreplace(heap,heap[0]+v)
        return max(heap)<t
    lo=1;hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if valid(mid):hi=mid
        else:lo=mid+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
