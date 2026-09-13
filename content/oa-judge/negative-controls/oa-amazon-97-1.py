def solve(d):
    import heapq
    n,m=map(int,d[:2]);idle=list(range(n));heapq.heapify(idle);busy=[];now=0;answer=[]
    for i,length in enumerate(map(int,d[2:])):
        now=max(now,i)
        if not idle:now=max(now,busy[0][0])
        while busy and busy[0][0]<=now:
            end,server=heapq.heappop(busy);heapq.heappush(idle,server)
        server=heapq.heappop(idle);answer.append(server);heapq.heappush(busy,(now+length+1,server))
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
