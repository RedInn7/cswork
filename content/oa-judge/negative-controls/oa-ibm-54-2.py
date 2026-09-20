def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));b=list(map(int,d[n+1:]));i=j=0;out=[]
    while i<n and j<n:
        if a[i]<=b[j]:out.append(a[i]);i+=1
        else:out.append(b[j]);j+=1
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
