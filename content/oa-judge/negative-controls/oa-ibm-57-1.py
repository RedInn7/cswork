def solve(d):
    seen=set();answer=1
    for c in d[0]:
        if c in seen:answer+=1;seen.clear()
        seen.add(c)
    return str(max(d[0].count(c) for c in set(d[0])))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
