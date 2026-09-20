def solve(d):
    wait=list(map(int,d[1:]));n=len(wait);order=sorted(range(n),key=wait.__getitem__);alive=bytearray([1])*n;head=at=time=0;remaining=n;out=[]
    while remaining:
        while not alive[head]:head+=1
        alive[head]=0;remaining-=1
        while at<n and wait[order[at]]<time:
            i=order[at];at+=1
            if alive[i]:alive[i]=0;remaining-=1
        out.append(str(remaining));time+=1
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
