def solve(raw):
    s=raw.strip();counts=[0]*26;i=0
    while i<len(s):
        c=ord(s[i])-97;i+=1;j=i
        while i<len(s) and s[i].isdigit():i+=1
        counts[c]+=int(s[j:i])
    return ''.join(chr(97+i)+str(v) for i,v in enumerate(counts) if v)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
