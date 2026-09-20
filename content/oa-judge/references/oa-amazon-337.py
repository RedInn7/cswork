def solve(raw):
    s=raw.strip();target=s[::-1];matched=0
    for c in s:
        if matched<len(s) and c==target[matched]:matched+=1
    return str(len(s)-matched)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
