def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:n+2]));b=list(map(int,d[n+2:]));events=sorted([(v,i,1) for i,v in enumerate(a)]+[(v,i,2) for i,v in enumerate(b)]);mask=bytearray(n);covered=front=left=0;answer=max(a)-min(a)
    for right,(value,i,side) in enumerate(events):
        covered+=mask[i]==0;mask[i]|=side;front+=side==1
        while covered==n and front>=0:
            answer=min(answer,value-events[left][0]);_,j,old=events[left];mask[j]^=old;covered-=mask[j]==0;front-=old==1;left+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
