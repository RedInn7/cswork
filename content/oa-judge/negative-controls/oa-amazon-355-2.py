def solve(raw):
    from bisect import bisect_left
    d=list(map(int,raw.split()));n,q=d[:2];a=sorted(d[2:2+n]);total=sum(a);out=[]
    for need,backup in zip(d[2+n::2],d[3+n::2]):
        p=bisect_left(a,need);answer=10**30
        for i in (p-1,p):
            if 0<=i<n:
                w=a[i];answer=min(answer,max(0,need-w)+max(0,backup-total))
        out.append(str(answer))
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
