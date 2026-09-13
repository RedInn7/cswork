def solve(d):
    s=d[0]
    while True:
        result=[];changed=False;i=0
        while i<len(s):
            j=i+1
            while j<len(s) and s[j]==s[i]:j+=1
            changed|=j-i>1;result.append(str(int(s[i])*(j-i)));i=j
        if not changed:return str(int(s))
        s=''.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
