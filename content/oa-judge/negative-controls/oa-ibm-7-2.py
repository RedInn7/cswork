def solve(d):
    n,q=map(int,d[:2]);pre=[0]
    for s in d[2:2+n]:pre.append(pre[-1]+(s[0] in 'aeiou' and s[-1] in 'aeiou'))
    out=[]
    for token in d[2+n:]:
        l,h=map(int,token.split('-'));out.append(pre[h]-pre[l])
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
