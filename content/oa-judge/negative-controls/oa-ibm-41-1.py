def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));champion=a[0];wins=0
    for v in a[1:]:
        if v>champion:champion=v;wins=0
        else:wins+=1
        if wins>=k:return str(champion)
    return str(champion)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
