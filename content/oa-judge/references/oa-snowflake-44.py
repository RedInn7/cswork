import heapq
def solve(d):
    n,k=map(int,d[:2]);heap=[-int(v) for v in d[2:]];heapq.heapify(heap)
    for _ in range(k):
        if heap[0]==-1:break
        value=-heap[0];heapq.heapreplace(heap,-((value+1)//2))
    return str(-sum(heap))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
