def solve(raw):
    s=raw.strip(); first={0:-1}; mask=0; best=0
    for i,c in enumerate(s):
        mask |= 1 << (ord(c)-97)
        if mask in first: best=max(best,i-first[mask])
        else: first[mask]=i
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
