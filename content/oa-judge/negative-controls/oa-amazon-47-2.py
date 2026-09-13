def solve(d):
    s=d[0];answer=0
    for start in range(len(s)):
        count=[0]*7; distinct=maximum=0
        for end in range(start,min(len(s),start+7)):
            k=ord(s[end])-97
            if count[k]==0:distinct+=1
            count[k]+=1;maximum=max(maximum,count[k]);answer+=maximum<=distinct
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
