import sys
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); out=[]
    for w in lines[1:1+n]:
        ans=0; i=0
        while i<len(w):
            j=i+1
            while j<len(w) and w[j]==w[i]: j+=1
            if j-i>1: ans+=1
            i=j
        out.append(str(ans))
    return " ".join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
