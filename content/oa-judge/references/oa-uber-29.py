def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));counts={};pairs=left=answer=0
    for right,v in enumerate(a):
        pairs+=counts.get(v,0);counts[v]=counts.get(v,0)+1
        while pairs>=k:
            answer+=n-right;old=a[left];counts[old]-=1;pairs-=counts[old];left+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
