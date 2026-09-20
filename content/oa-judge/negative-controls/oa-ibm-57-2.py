def solve(d):
    seen=set();answer=1
    for c in d[0]:
        if c in seen:answer+=1;pass
        seen.add(c)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
