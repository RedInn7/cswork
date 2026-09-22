def solve(raw):
    import heapq
    a=[-int(v) for v in raw.split()[1:]];heapq.heapify(a);answer=0
    while len(a)>1:
        total=heapq.heappop(a)+heapq.heappop(a);answer+=total;heapq.heappush(a,total)
    return str(-answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
