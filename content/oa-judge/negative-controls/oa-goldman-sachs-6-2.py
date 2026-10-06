import sys
def solve(raw):
    v=list(map(int,raw.split()));n,cost,price=v[:3];a=v[3:3+n];best=0
    for sale in range(1,max(a)+1):
        gain=0
        for rod in a:
            k=rod//sale
            if k:
                cuts=k-1 if rod%sale==0 else k
                gain+=k*sale*price-cuts*cost
        best=max(best,gain)
    return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
