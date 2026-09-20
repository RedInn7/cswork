def solve(raw):
    import heapq
    a=list(map(int,raw.split()))[1:];groups={}
    for i,v in enumerate(a):groups.setdefault(v,[]).append(i)
    heap=[-v for v,ids in groups.items() if len(ids)>=2 and v>0];heapq.heapify(heap)
    while heap:
        p=-heapq.heappop(heap);ids=groups[p]
        if len(ids)<2:continue
        first=heapq.heappop(ids);second=heapq.heappop(ids);a[first]=None;a[second]=p//2
        if len(ids)>=2:heapq.heappush(heap,-p)
        q=p//2;target=groups.setdefault(q,[]);heapq.heappush(target,second)
        if q>0 and len(target)>=2:heapq.heappush(heap,-q)
    out=[v for v in a if v is not None]
    return str(len(out))+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
