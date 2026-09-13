def solve(d):
    s=d[0]; m=int(d[1]); left=[0]*26; right=[0]*26; answer=0
    for c in s: right[ord(c)-97]+=1
    for c in s[:-1]:
        k=ord(c)-97; left[k]+=1; right[k]-=1
        answer+=sum(min(a,b) for a,b in zip(left,right))>m
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
