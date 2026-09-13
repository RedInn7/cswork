def solve(d):
    events={}
    for i in range(1,len(d),2):
        x,r=map(int,d[i:i+2]);events[x-r]=events.get(x-r,0)+1;events[x+r]=events.get(x+r,0)-1
    count=best=0;answer=0
    for position in sorted(events):
        count+=events[position]
        if count>best:best=count;answer=position
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
