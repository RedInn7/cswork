def solve(raw):
    a=list(map(int,raw.split()))[1:];totals=[]
    for first in (0,1):
        cost=0
        for i,v in enumerate(a):
            target=first^(i&1)
            if v%2!=target:cost+=1
        totals.append(cost)
    return str(min(totals))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
