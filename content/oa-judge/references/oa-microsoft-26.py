def solve(d):
    s=d[0];cut=len(s)-1
    for i in range(len(s)-1):
        if s[i]>s[i+1]:cut=i;break
    return s[:cut]+s[cut+1:]

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
