def solve(raw):
    previous=None;answer=0
    for c in raw.strip():
        if c=='?':continue
        if previous is not None and previous!=c:answer+=2
        previous=c
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
