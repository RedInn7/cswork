def solve(data):
    import heapq
    occupied={}; free=[]; next_id=1; answer=0
    for visitor in data[1:]:
        if visitor in occupied:heapq.heappush(free,occupied.pop(visitor))
        else:
            if free:answer=heapq.heappop(free)
            else:answer=next_id; next_id+=1
            occupied[visitor]=answer
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
