def solve(d):
    n,days=map(int,d[:2]);a=list(map(int,d[2:]));b=[0]*10001;total=sum(a)
    for w in a:b[w]+=1
    top=max(a)
    for _ in range(days):
        while top>1 and not b[top]:top-=1
        if top==1:break
        b[top]-=1;v=(top+1)//2;b[v]+=1;total-=top-v
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
