def solve(d):
    n,t=map(int,d[:2]);events=sorted((d[i],int(d[i+1])) for i in range(2,len(d),2));last=None;answer=0
    for u,time in events:
        if last is None or u!=last[0] or time-last[1]>t:answer+=1
        last=(u,time)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
