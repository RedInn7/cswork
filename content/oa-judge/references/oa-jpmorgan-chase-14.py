import heapq
def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);small=[(v,i) for i,v in enumerate(a)];large=[(-v,i) for i,v in enumerate(a)];heapq.heapify(small);heapq.heapify(large);alive=[True]*(2*n);cost=0
    for ident in range(n,2*n-1):
        while not alive[small[0][1]]:heapq.heappop(small)
        low,i=heapq.heappop(small);alive[i]=False
        while not alive[large[0][1]]:heapq.heappop(large)
        neg,j=heapq.heappop(large);alive[j]=False;high=-neg
        value=low+high;den=high-low+1;cost+=-((-value)//den)
        heapq.heappush(small,(value,ident));heapq.heappush(large,(-value,ident))
    return str(cost)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
