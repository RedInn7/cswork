def solve(raw):
    import json
    s,k=json.loads(raw);answer=0
    for start in range(len(s)-k+1):
        left=start;right=start+k-1
        while left<right and s[left]==s[right]:left+=1;right-=1
        if left<right and s[right]<s[left]:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
