def solve(raw):
    a=list(map(int,raw.split()[1:]));a.sort(key=lambda v:(v,));return ' '.join(map(str,a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
