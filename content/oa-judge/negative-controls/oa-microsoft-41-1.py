def solve(d):
    from bisect import bisect_right
    import heapq
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));m=n//3;answer=a[-m]-a[m-1]
    sides=[sorted(-v for v in a[:m]),a[-m:]];heap=[]
    for side,b in enumerate(sides):heap.append((bisect_right(b,b[0]),side,b[0]))
    heapq.heapify(heap)
    while k and heap:
        count,side,level=heapq.heappop(heap);b=sides[side];distance=b[count]-level if count<m else k+1
        increase=min(distance,k);answer+=increase;k-=increase*count
        if increase<distance:break
        level+=increase;heapq.heappush(heap,(bisect_right(b,level),side,level))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
