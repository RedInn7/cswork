def solve(raw):
    import heapq
    a=map(int,raw.split()[1:]);heap=[];balance=0
    for v in a:
        balance-=v;heapq.heappush(heap,-v)
        if balance<=0:balance+=2*v;heapq.heappop(heap)
    return str(len(heap))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
