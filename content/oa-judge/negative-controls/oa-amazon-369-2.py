def solve(raw):
    a=sorted(map(int,raw.split()[1:]),reverse=True)
    return str(sum(value-i for i,value in enumerate(a)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
