def solve(data):
    import heapq
    values=list(map(int,data[1:]));requests=list(zip(values[::2],values[1::2]));busy=[];free=[];cars=[]
    for p,r in sorted(requests):
        while busy and busy[0][0]<p:
            end,car=heapq.heappop(busy);heapq.heappush(free,car)
        if free:car=heapq.heappop(free)
        else:car=len(cars);cars.append([])
        cars[car].append((p,r));heapq.heappush(busy,(r,car))
    return str(len(cars))+'\n'+'\n'.join(f'{i}: '+' '.join(f'({p},{r})' for p,r in car) for i,car in enumerate(cars))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
