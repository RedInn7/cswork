def solve(d):
    s=d[0];seen=set();answer=1
    for c in s:
        if c in seen:answer+=1;seen.clear()
        seen.add(c)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
