def solve(d):
    s=d[0];i=1;answer=0
    while i<len(s):
        if abs(ord(s[i])-ord(s[i-1]))<=1:answer+=1;i+=1
        else:i+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
