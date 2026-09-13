def solve(d):
    n,m,magic,mod=map(int,d);rows=[0]*n;cols=[0]*m
    for i in range(n):
        for j in range(m):
            if ((i+j*magic)%mod)%2:rows[i]+=1;cols[j]+=1
    answer=0
    for i in range(n):
        for j in range(m):
            if ((i+j*magic)%mod)%2:answer+=(rows[i]-1)*(cols[j]-1)
    return str(answer//3)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
