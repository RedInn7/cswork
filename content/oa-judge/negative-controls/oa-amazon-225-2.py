def solve(d):
    import heapq
    n=int(d[0]);a=list(map(int,d[1:1+n]));c=list(map(int,d[1+n:]));items=sorted(zip(a,c));heap=[];i=0;pos=0;answer=0
    while i<n or heap:
        if not heap:pos=max(pos,items[i][0])
        while i<n and items[i][0]<=pos:
            start,cost=items[i];heapq.heappush(heap,(-cost,start,cost));i+=1
        _,start,cost=heapq.heappop(heap);answer+=cost if pos>start else 0;pos+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
