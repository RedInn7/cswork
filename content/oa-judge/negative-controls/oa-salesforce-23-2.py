def solve(raw):
    v=list(map(int,raw.split()));n=v[0];development=v[1:n+1];integration=v[n+1:];lo=0;hi=max(development)
    while lo<hi:
        mid=(lo+hi)//2;required=max([0]+[b for a,b in zip(development,integration) if a>mid])
        if required<=mid:hi=mid
        else:lo=mid+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
