def solve(raw):
    d=list(map(int,raw.split()));n,limit=d[:2];primary=d[2:2+n];secondary=sorted(d[2+n:])
    if any(v>limit for v in primary):return '-1'
    answer=0
    for capacity in sorted((limit-v for v in primary),reverse=True):
        if answer<n and secondary[answer]<=capacity:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
