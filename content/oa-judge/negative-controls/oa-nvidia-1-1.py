def solve(d):
    n=int(d[0]);p=list(map(int,d[1:]));total=sum(p)//n
    return ' '.join(str(total-v) for v in p)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
