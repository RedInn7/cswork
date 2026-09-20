def solve(d):
    n,p,k=map(int,d[:3]);a=sorted(map(int,d[3:]),reverse=False);total=sum(a);answer=total;saved=0
    for j in range(1,min(k,n//2)+1):
        saved+=a[2*j-2]+a[2*j-1];answer=min(answer,total-saved+j*p)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
