import heapq
import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; values=t[1:1+n]
    heap=[]; stamina=0
    for value in values:
        heapq.heappush(heap,value); stamina+=value
        if stamina<0: stamina-=heapq.heappop(heap)
    return str(len(heap))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
