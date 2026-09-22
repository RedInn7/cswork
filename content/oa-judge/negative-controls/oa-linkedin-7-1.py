def solve(raw):
    a=list(map(int,raw.split()[1:]));n=len(a)
    if n<3:return '0'
    cost=[max(0,max(a[i-1],a[i+1])-a[i]) for i in range(1,n-1)]
    if n%2:return str(sum(cost[::2]))
    value=sum(cost[1::2]);answer=value
    for odd,even in zip(cost[::2],cost[1::2]):value+=odd-even;answer=min(answer,value)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
