def solve(d):
    seen=set()
    for c in d:
        if 'A'<=c<='Z':break
        if 'a'<=c<='z':seen.add(c)
    return str(len(seen))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
