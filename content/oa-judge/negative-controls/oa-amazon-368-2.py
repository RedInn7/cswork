def solve(raw):
    d=list(map(int,raw.split()));n,x=d[:2];counts={};answer=0
    for value in d[2:]:
        r=value%x;answer+=counts.get((-r)%x,0);counts[r]=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
