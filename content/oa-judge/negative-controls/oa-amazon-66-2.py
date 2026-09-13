def solve(d):
    a,b=d;n=len(a);m=len(b)
    def greater(s):
        rows=[[0]*26];counts=[0]*26
        for c in s:
            counts[ord(c)-97]+=1;row=[0]*26;total=0
            for k in range(25,-1,-1):row[k]=total;total+=counts[k]
            rows.append(row)
        return rows
    ga=greater(a);gb=greater(b);previous=[0]*(m+1)
    for j in range(1,m+1):previous[j]=previous[j-1]+gb[j-1][ord(b[j-1])-97]
    for i in range(1,n+1):
        ca=ord(a[i-1])-97;current=[0]*(m+1);current[0]=previous[0]+ga[i-1][ca]
        for j in range(1,m+1):
            cb=ord(b[j-1])-97
            current[j]=max(previous[j]+ga[i-1][ca]+gb[j][ca],current[j-1]+ga[i][cb]+gb[j-1][cb])
        previous=current
    return str(previous[m])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
