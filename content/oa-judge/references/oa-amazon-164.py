def solve(d):
    n=int(d[0]);a=sorted(map(int,d[1:1+n]));b=sorted(map(int,d[1+n:]));j=0
    for v in a:
        if j<n and v>b[j]:j+=1
    return str(j)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
