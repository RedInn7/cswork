def solve(raw):
    a=list(map(int,raw.split()))[1:];prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    counts={};answer=0
    for r in range(len(a)):
        l=r-2
        if l>=0:
            key=(a[l],prefix[l]+a[l]);counts[key]=counts.get(key,0)+1
        answer+=counts.get((a[r],prefix[r]),0)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
