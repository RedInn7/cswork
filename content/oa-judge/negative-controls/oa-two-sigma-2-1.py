def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];seen={};answer=0
    for v in d[2:]:
        r=v%k;seen[r]=seen.get(r,0)+1;answer+=seen.get((-r)%k,0)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
