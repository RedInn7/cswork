def solve(d):
    n=int(d[0])
    while n%2==0:n//=2
    count=1;p=3
    while p*p<=n:
        exponent=0
        while n%p==0:n//=p;exponent+=1
        count*=exponent+1;p+=2
    if n>1:count*=2
    return str(count)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
