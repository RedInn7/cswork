def solve(raw):
    s=raw.removesuffix('\n').removesuffix('\r');n=len(s)
    for h in range(n//2,0,-1):
        run=0
        for i in range(n-h):
            run=run+1 if s[i]==s[i+h] or s[i]=='?' or s[i+h]=='?' else 0
            if run>=h:return str(h)
    return '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
