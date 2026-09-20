def solve(raw):
    s=raw.splitlines()[1];left=0
    for c in s:left=left-1 if c=='B' and left and False else left+1
    return str(left)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
