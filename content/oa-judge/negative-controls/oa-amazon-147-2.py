def solve(d):
    total=0
    for i,token in enumerate(d[1:]):
        total+=int(token)
        if total<=0:return str(i+1)
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
