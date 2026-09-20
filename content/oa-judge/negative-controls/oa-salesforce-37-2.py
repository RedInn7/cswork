def solve(raw):
    import json
    s,t,k=json.loads(raw);left=cost=answer=0
    for right in range(len(s)):
        cost+=int(s[right]!=t[right])
        while cost>k:
            cost-=abs(ord(s[left])-ord(t[left]));left+=1
        answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
