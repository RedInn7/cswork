import sys
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); out=[]
    for w in lines[1:1+n]:
        out.append(str(sum(1 for i in range(1,len(w)) if w[i]==w[i-1])))
    return " ".join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
