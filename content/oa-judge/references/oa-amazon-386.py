def solve(raw):
    a=list(map(int,raw.split()[1:]));totals=[0,0]
    for i,v in enumerate(a):totals[i%2]+=max(v,0)
    return str(max(totals) if max(totals)>0 else max(a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
