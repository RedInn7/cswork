def solve(raw):
    d=list(map(int,raw.split()))[1:];events=[]
    for l,h in zip(d[::2],d[1::2]):events.extend(((l,1),(h+1,-1)))
    events.sort();active=answer=0
    for t,delta in events:active+=delta;answer=max(answer,active)
    return str(len(d)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
