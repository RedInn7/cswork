def solve(d):
    seen={};answer=1
    for i,c in enumerate(d[0]):answer+=i-seen.get(c,0);seen[c]=seen.get(c,0)+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
