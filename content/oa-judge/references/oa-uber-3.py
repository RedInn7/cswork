def solve(d):
    s=d[0];answer=0
    for i in range(1,len(s)):
        if s[i].lower()!=s[i-1].lower():answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
