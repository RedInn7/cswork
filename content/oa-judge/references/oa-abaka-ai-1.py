def solve(raw):
    from collections import defaultdict
    v=list(map(int,raw.split()));n,limit=v[:2];memory=v[2:2+n];kind=v[2+n:2+2*n];groups=defaultdict(list)
    for m,t in zip(memory,kind):groups[t].append(m)
    pairs=0
    for values in groups.values():
        values.sort();left=0;right=len(values)-1
        while left<right:
            if values[left]+values[right]<=limit:pairs+=1;left+=1
            right-=1
    return str(n-pairs)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
