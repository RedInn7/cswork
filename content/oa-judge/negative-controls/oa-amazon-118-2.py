def solve(d):
    count={};answer=1
    for i,c in enumerate(d[0]):answer+=i;count[c]=count.get(c,0)+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
