def solve(d):
    left=missing=0
    for c in d[0]:
        if c=='(':left+=1
        elif left:left-=1
        else:missing+=1
    return str(left+missing)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
