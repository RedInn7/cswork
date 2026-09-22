def solve(raw):
    a=list(map(int,raw.split()[1:]));return str(sum(abs(a[i]-a[i-1]) for i in range(1,len(a))))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
