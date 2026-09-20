def solve(d):
    a=list(map(int,d[1:]));powers=[];p=1
    while p<=2*max(a):powers.append(p);p*=3
    seen={};answer=0
    for v in a:
        for p in powers:answer+=seen.get(p-v,0)
        seen[v]=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
