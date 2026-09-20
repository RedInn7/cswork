def solve(raw):
    import heapq
    d=list(map(int,raw.split()));n=d[0];items=sorted(zip(d[1:n+1],d[n+1:]));heap=[];i=0;slot=0;answer=0
    while i<n or heap:
        if not heap:slot=max(slot,items[i][0])
        while i<n and items[i][0]<=slot:
            size,cost=items[i];heapq.heappush(heap,(cost,size));i+=1
        negcost,size=heapq.heappop(heap);answer+=(slot-size)*(-negcost);slot+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
