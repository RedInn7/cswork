def solve(data):
    v=list(map(int,data.split())); n=v[0]; a=v[1:1+n]; total=0; i=0
    while i<n:
        if a[i]==0: i+=1; continue
        x=a[i]; total+=x
        for j in range(i,n):
            if a[j]>=x: a[j]-=x
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
