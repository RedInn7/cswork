def solve(d):
    m,n=map(int,d[:2]);edges=list(map(int,d[2:2+m]));prefix=[0]
    for w in edges:prefix.append(prefix[-1]+w)
    previous=0;answer=0
    for index in range(2+m,len(d)):
        current=int(d[index])-1;distance=abs(prefix[current]-prefix[previous]);answer+=min(distance,prefix[-1]-distance);previous=current
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
