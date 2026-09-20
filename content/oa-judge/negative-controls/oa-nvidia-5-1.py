def solve(d):
    s=d[0]
    for i in range(len(s)//2):
        if s[i]!='a':return s[:i]+'a'+s[i+1:]
    return s[:-1]+'b'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
