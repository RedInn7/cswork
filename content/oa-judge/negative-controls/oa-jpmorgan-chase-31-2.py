import heapq
def solve(raw):
    a=[-int(v) for v in raw.split()[1:]];heapq.heapify(a);cost=0
    while len(a)>1:
        value=heapq.heappop(a)+heapq.heappop(a);cost-=value;heapq.heappush(a,value)
    return str(cost)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
