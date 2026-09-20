def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return '\n'.join(str(w//4+1) for w in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
