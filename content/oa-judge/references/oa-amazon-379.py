def solve(raw):
    from bisect import bisect_right
    d=list(map(int,raw.split()));n,m=d[:2];first={}
    for i,v in enumerate(d[2:2+n]):first.setdefault(v,i)
    capacities=sorted(first);answer=[]
    for weight in d[2+n:]:
        j=bisect_right(capacities,weight);answer.append(first[capacities[j]] if j<len(capacities) else -1)
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
