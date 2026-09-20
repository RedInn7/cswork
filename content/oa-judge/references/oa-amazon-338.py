def solve(raw):
    d=raw.split();s=d[0].lower();words=d[2:];left=answer=0
    for right in range(len(s)):
        for word in words:
            start=right-len(word)+1
            if start>=0 and s[start:right+1]==word:left=max(left,start+1)
        answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
