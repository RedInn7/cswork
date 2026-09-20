import heapq
def solve(d):
    n,t,k=map(int,d[:3]);a=list(map(int,d[3:]));heap=[];left=0;right=n-1
    for _ in range(k):
        if left<=right:heapq.heappush(heap,(-a[left],left,0));left+=1
    for _ in range(k):
        if left<=right:heapq.heappush(heap,(-a[right],right,1));right-=1
    answer=0
    for _ in range(1):
        value,idx,side=heapq.heappop(heap);answer-=value
        if left<=right:
            if side==0:heapq.heappush(heap,(-a[left],left,0));left+=1
            else:heapq.heappush(heap,(-a[right],right,1));right-=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
