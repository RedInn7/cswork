def solve(d):
    count={};answer=0
    for i,c in enumerate(d[0]):answer+=i-count.get(c,0);count[c]=count.get(c,0)+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
