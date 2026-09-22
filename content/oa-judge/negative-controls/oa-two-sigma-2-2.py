def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];seen={};answer=0
    for v in d[2:]:
        r=v%k;answer+=seen.get((-r)%k,0) if r!=(-r)%k else 0;seen[r]=seen.get(r,0)+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
