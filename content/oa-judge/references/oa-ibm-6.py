def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));i=j=0;out=[]
    while i<n and j<n:
        if a[i]<=b[j]:out.append(a[i]);i+=1
        else:out.append(b[j]);j+=1
    out+=a[i:]+b[j:];return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
