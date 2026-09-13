def solve(d):
    n,q=map(int,d[:2]);initial=list(map(int,d[2:2+n]));answer=[None]*n;floor=0
    for j in range(len(d)-3,1+n,-3):
        typ,x,v=map(int,d[j:j+3])
        if typ==2:floor=max(floor,v)
        elif answer[x-1] is None:answer[x-1]=max(v,floor)
    for i in range(n):
        if answer[i] is None:answer[i]=max(initial[i],floor)
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
