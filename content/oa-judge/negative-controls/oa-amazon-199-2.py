def solve(d):
    s=d[0];k=0;answer=0
    for start in (0,1):
        left=bad=0
        for right,c in enumerate(s):
            bad+=int(c)!=((right+start)%2)
            while bad>k:
                bad-=int(s[left])!=((left+start)%2);left+=1
            answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
