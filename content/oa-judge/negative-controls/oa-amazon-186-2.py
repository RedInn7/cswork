def solve(d):
    last={};tail=answer=0
    for i,c in enumerate(d[0]):tail+=i-last.get(c,-1);last[c]=i;answer+=tail
    return str(tail)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
