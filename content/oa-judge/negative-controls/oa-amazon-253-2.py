def solve(d):
    a=list(map(int,d[1:]));seen=set()
    for i in range(len(a)-1,-1,-1):
        if a[i] in seen:return str(i)
        seen.add(a[i])
    return '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
