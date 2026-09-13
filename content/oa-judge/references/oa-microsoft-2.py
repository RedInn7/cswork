def solve(d):
    n=int(d[0]); a=list(map(int,d[1:1+n])); b=list(map(int,d[1+n:])); forced={x for x,y in zip(a,b) if x==y}; answer=1
    while answer in forced:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
