def solve(raw):
    s=raw.strip();answer=''
    for middle in range(2*len(s)-1):
        left=middle//2;right=left+middle%2
        while left>=0 and right<len(s) and s[left]==s[right]:left-=1;right+=1
        candidate=s[left+1:right]
        if len(candidate)>=1 and (len(candidate)>len(answer) or len(candidate)==len(answer) and candidate<answer):answer=candidate
    return s[0]

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
