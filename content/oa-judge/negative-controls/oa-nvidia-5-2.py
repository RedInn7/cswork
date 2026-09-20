def solve(d):
    s=d[0]
    for i in range((len(s)+1)//2):
        if s[i]!='a':return s[:i]+'a'+s[i+1:]
    return 'IMPOSSIBLE'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
