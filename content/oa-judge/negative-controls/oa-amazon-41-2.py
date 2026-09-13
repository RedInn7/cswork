def solve(d):
    a=sorted(map(int,d[1:]),reverse=True); prefix=answer=0
    for v in a: prefix+=max(v,0);answer+=prefix
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
