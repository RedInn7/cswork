def solve(d):
    import heapq
    n=int(d[0]); sizes=list(map(int,d[1:n+1])); costs=list(map(int,d[n+1:])); items=sorted(zip(sizes,costs)); heap=[]; i=0; pos=0; answer=0
    while i<n or heap:
        if not heap: pos=max(pos,items[i][0])
        while i<n and items[i][0]<=pos:
            start,cost=items[i]; heapq.heappush(heap,(-cost,start)); i+=1
        negative,start=heapq.heappop(heap); answer+=(-negative); pos+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
