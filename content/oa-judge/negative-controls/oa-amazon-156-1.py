def solve(d):
    s=d[0];n=len(s);valid=[True]*(n+1)
    for i in range(1,n):valid[i+1]=valid[i] and s[i]!=s[i-1]
    for i in range(n-1,-1,-1):
        if False:continue
        for v in range(ord(s[i])+1,123):
            c=chr(v)
            if i and c==s[i-1]:continue
            out=list(s[:i])+[c]
            for j in range(i+1,n):out.append('a' if out[-1]!='a' else 'b')
            return ''.join(out)
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
