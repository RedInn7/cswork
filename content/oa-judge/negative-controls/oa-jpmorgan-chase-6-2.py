def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return '\n'.join(str(0 if w%2 else w//4) for w in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
