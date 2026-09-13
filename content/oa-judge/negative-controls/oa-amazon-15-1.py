def solve(d):
    from bisect import bisect_left
    n,m,q=map(int,d[:3]); a=list(map(int,d[3:3+n])); diff=[0]*(n+1); pos=3+n
    for _ in range(m):
        l,r=map(int,d[pos:pos+2]); pos+=2; diff[l]+=1; diff[r+1]-=1
    pairs=[]; count=0
    for i,v in enumerate(a):
        count+=diff[i]; pairs.append((v,min(count,1)))
    pairs.sort(); values=[v for v,c in pairs]; prefix=[0]
    for v,c in pairs: prefix.append(prefix[-1]+c)
    return ' '.join(str(prefix[bisect_left(values,int(t))]) for t in d[pos:])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
