def solve(d):
    a=list(map(int,d[1:]));even=sum(v%2==1 for v in a);return str(sum(v%2==0 for v in a[:even]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
