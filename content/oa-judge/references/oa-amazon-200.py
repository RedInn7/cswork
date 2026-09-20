def solve(d):
    s=d[0];k=int(d[1]);left=groups=answer=0
    for right,c in enumerate(s):
        if c=='0' and (right==0 or s[right-1]=='1'):groups+=1
        while groups>k:
            if s[left]=='0' and (left==right or s[left+1]=='1'):groups-=1
            left+=1
        answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
