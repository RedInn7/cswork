def solve(d):
    s,t=d;direction=0;same=opposite=0
    for a,b in zip(s,t):
        if a==b:continue
        sign=1 if a>b else -1
        if not direction:direction=sign
        elif sign==direction:same+=1
        else:opposite+=1
    return str(same if direction else 0)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
