def solve(d):
    s=d[0];last=-1;keep=len(s)
    for j,c in enumerate(s):
        if c==s[0]:last=j
        if c==s[-1] and last>=0:keep=min(keep,max(2,j-last+1))
    return str(len(s)-keep)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
