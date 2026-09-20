def solve(raw):
    s,amount,bits=raw.split();k=int(amount);left=normal=answer=0
    for right,ch in enumerate(s):
        normal+=bits[ord(ch)-97]=='1'
        while normal>k:
            normal-=bits[ord(s[left])-97]=='1';left+=1
        answer=max(answer,right-left+1)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
