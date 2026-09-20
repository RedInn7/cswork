def solve(raw):
    import heapq
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:];heap=list(zip(a,b));heapq.heapify(heap);answer=0
    for _ in range(m):
        price,step=heapq.heappop(heap);answer+=price;heapq.heappush(heap,(price+step,step))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
