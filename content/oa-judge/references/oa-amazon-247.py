def solve(d):
    regex=d[0];words=['' if s=='-' else s for s in d[2:]];atoms=[];i=0
    while i<len(regex):
        if regex[i]=='(':
            end=regex.index(')',i);pat=regex[i+1:end];i=end+1
        else:pat=regex[i];i+=1
        star=i<len(regex) and regex[i]=='*'
        if star:i+=1
        atoms.append((pat,star))
    results=[]
    for word in words:
        m=len(word);dp=bytearray(m+1);dp[0]=1
        for pat,star in atoms:
            if not pat:continue
            length=len(pat);nxt=bytearray(dp) if star else bytearray(m+1)
            for end in range(length,m+1):
                if not (nxt[end-length] if star else dp[end-length]):continue
                good=True
                for offset,p in enumerate(pat):
                    c=word[end-length+offset]
                    if not(p=='.' or p==c):good=False;break
                if good:nxt[end]=1
            dp=nxt
        results.append('YES' if dp[m] else 'NO')
    return '\n'.join(results)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
