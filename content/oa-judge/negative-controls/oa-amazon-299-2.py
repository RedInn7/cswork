def solve(d):
    a,b=d;n=len(a);m=len(b)
    def tables(s):
        out=[]
        for c in range(26):
            row=[0];total=0
            for v in s:total+=ord(v)-97>c;row.append(total)
            out.append(row)
        return out
    A=tables(a);B=tables(b);previous=[0]*(m+1)
    for j in range(1,m+1):previous[j]=previous[j-1]+B[ord(b[j-1])-97][j-1]
    for i in range(1,n+1):
        c=ord(a[i-1])-97;current=[previous[0]+0]+[0]*m
        for j in range(1,m+1):
            e=ord(b[j-1])-97
            current[j]=min(previous[j]+0+B[c][j],current[j-1]+A[e][i]+B[e][j-1])
        previous=current
    return str(previous[m])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
