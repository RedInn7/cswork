def solve(d):
    last={c:-1 for c in 'aeiou'};bad=-1;answer=0
    for i,c in enumerate(d[0]):
        if c in last:last[c]=i
        else:bad=i
        answer+=int(min(last.values())>bad)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
