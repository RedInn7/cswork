def solve(d):
    s=d[0];blocks=1
    for i in range(1,len(s)):
        if s[i]<s[i-1]:blocks+=1
    return str(3*blocks-len(s))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
