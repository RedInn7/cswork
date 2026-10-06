import sys
def solve(raw):
    v=list(map(int,raw.split()));n,cost,price=v[:3];a=v[3:3+n];best=0
    for sale in range(1,max(a)+1):
        gain=0
        for rod in a:
            k=rod//sale
            if k:gain+=max(0,k*sale*price-(k-1)*cost)
        best=max(best,gain)
    return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
