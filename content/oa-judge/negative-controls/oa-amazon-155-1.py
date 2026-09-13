def solve(d):
    s=d[0];first={};last={}
    for i,c in enumerate(s):first.setdefault(c,i);last[c]=i
    answer=0;n=len(s)
    for left in first.values():
        end=left
        for right in range(left,n):
            c=s[right]
            if first[c]<left:break
            end=max(end,last[c])
            if right>=end:answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
