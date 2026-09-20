def solve(d):
    s=d[0];i=1;answer=0
    while i<len(s):
        if abs(ord(s[i])-ord(s[i-1]))==0:answer+=1;i+=2
        else:i+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
