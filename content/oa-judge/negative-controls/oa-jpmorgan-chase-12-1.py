def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=sorted(d[1:n+1]);b=sorted(d[n+1:]);j=0
    for v in a:
        if j<n and v>=b[j]:j+=1
    return str(j)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
