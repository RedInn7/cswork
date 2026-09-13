def solve(d):
    n,target=map(int,d[:2]);events={}
    for i in range(2,len(d),2):
        a,b=int(d[i]),int(d[i+1]);events[a]=events.get(a,0)+1;events[b+1]=events.get(b+1,0)-1
    active=total=0;previous=0
    for t,delta in sorted(events.items()):
        contribution=active*(t-previous)
        if active and total+contribution>=target:return str(previous+(target-total+active-1)//active)
        total+=contribution;active+=delta;previous=t
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
