def solve(d):
    lo,hi=map(int,d);answer=0;a=1
    while a<=hi:
        v=a
        while v<=hi:
            if v>=lo:answer+=1
            if v>hi//5:break
            v*=5
        if a>hi//3:break
        a*=3
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
