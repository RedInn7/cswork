def solve(d):
    s,f=d;previous=0;answer=0
    for i,c in enumerate(s):
        if c==f:answer=max(answer,i-previous);previous=i
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
