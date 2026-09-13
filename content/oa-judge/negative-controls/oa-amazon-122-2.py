def solve(d):
    k=int(d[1]);values=set(map(int,d[2:]));return str(sum(a+k in values and k!=0 for a in values))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
