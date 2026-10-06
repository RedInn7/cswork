def solve(raw):
    v=list(map(int,raw.split()));n,k=v[:2];a=v[2:2+n];p=sorted(v[2+n:2+n+k]);prefix=[0]
    for x in a:prefix.append(prefix[-1]+x)
    total=0
    for i in range(k//2):total+=prefix[p[k-1-i]]-prefix[p[i]]
    return str(total%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
