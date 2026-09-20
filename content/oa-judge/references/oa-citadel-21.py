def solve(raw):
    s=raw.strip();answer=0
    for center in range(2*len(s)-1):
        left=center//2;right=(center+1)//2
        while left>=0 and right<len(s) and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
