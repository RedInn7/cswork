def solve(d):
    a=list(map(int,d[1:]));n=len(a);ascending=min(v-i for i,v in enumerate(a));descending=max(v+i for i,v in enumerate(a));total=sum(a);offset=n*(n-1)//2
    return str(min(n*ascending+offset-total,n*descending-offset-total))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
