def solve(d):
    n,k=map(int,d[:2]);table={};best=[0]*(k+1)
    for value in map(int,d[2:]):
        if value not in table:table[value]=[0]*(k+1)
        row=table[value]
        for j in range(k,-1,-1):
            row[j]=max(row[j]+1,best[j-1]+1 if j else 1);best[j]=max(best[j],row[j])
    return str(best[k])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
