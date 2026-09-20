def solve(d):
    n=int(d[0]);login=list(map(int,d[1:n+1]));logout=list(map(int,d[n+1:]));delta=[0]*100002
    for a,b in zip(login,logout):delta[a]+=1;delta[b]-=1
    current=best=count=0
    for day in range(100001):
        current+=delta[day]
        if current>best:best=current;count=1
        elif current==best:count+=1
    return str(count)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
