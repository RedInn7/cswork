def solve(raw):
    a=list(map(int,raw.split()[1:]));return str(max(a)-min(a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
