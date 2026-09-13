def solve(d):
    import heapq
    n,m=map(int,d[:2]);heap=[-int(v) for v in d[2:2+n]];heapq.heapify(heap)
    for weight in sorted(map(int,d[2+n:]),reverse=True):
        capacity=-heapq.heappop(heap)
        if capacity<weight:return '0'
        heapq.heappush(heap,-capacity)
    return '1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
