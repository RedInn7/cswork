def solve(raw):
    a=set(map(int,raw.split()[1:]));best=1
    for start in a:
        v=start;length=1
        while v<=1000 and v*v in a:v*=v;length+=1
        best=max(best,length)
    return str(best if best>=2 else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
