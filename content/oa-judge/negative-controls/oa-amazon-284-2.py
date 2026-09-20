def solve(d):
    positive=set()
    for i in range(1,len(d)):
        value=int(d[i])
        if value:positive.add(value)
    return str(sum(int(v)>0 for v in d[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
