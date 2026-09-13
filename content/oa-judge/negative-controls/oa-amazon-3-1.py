def solve(d):
    s=d[0]; first={}; last={}; answer=0
    for i,c in enumerate(s):
        if c not in first: first[c]=i
        last[c]=i
    for start in first.values():
        end=start
        for i in range(start,len(s)):
            c=s[i]
            if first[c]<start: break
            end=max(end,last[c])
            if i==end and i-start+1<=len(s): answer=max(answer,i-start+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
