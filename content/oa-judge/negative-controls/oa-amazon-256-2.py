def solve(d):
    a=list(map(int,d[1:]));last={v:i for i,v in enumerate(a)};end=-1;blocks=0
    for i,v in enumerate(a):
        end=max(end,last[v])
        if i==end:blocks+=1
    return str(len(a)-len(last))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
