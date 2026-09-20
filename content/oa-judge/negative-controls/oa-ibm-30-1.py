def solve(d):
    from collections import defaultdict
    events=defaultdict(int)
    for i in range(1,len(d),2):
        l,h=int(d[i]),int(d[i+1]);events[l]+=1;events[h]-=1
    current=best=0;answer=0
    for t in sorted(events):
        current+=events[t]
        if current>best:best=current;answer=t
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
