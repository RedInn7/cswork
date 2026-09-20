def solve(d):
    out=[]
    for s in d[1:]:
        level=low=0
        for c in s:level+=1 if c=='(' else -1;low=min(low,level)
        out.append(int(level==0 and low>=-1))
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
