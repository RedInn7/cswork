def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);answer=sum(max(0,a[2*j]) for j in range(len(a)//3));return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
