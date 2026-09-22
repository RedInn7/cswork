def solve(raw):
    s,p=raw.split('\n')[:2];s=s.removesuffix('\r');p=p.removesuffix('\r');n=len(s)
    def matches(pattern):
        found=bytearray(n+1)
        if not pattern:return bytearray(b'\1')*(n+1)
        pi=[0]*len(pattern);j=0
        for i in range(1,len(pattern)):
            while j and pattern[i]!=pattern[j]:j=pi[j-1]
            if pattern[i]==pattern[j]:j+=1
            pi[i]=j
        j=0
        for i,c in enumerate(s):
            while j and c!=pattern[j]:j=pi[j-1]
            if c==pattern[j]:j+=1
            if j==len(pattern):found[i-j+1]=1;j=pi[j-1]
        return found
    if '*' not in p:
        a=matches(p);return str(next((i for i,v in enumerate(a) if v),-1))
    k=p.index('*');a=matches(p[:k]);b=matches(p[k+1:])
    return str(next((i for i in range(n-len(p)+1) if a[i] and b[i+k+1]),-1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
