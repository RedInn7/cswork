def solve(d):
    a=list(map(int,d[1:]));seen=set();before=[]
    for v in a:before.append('1' if v in seen else '0');seen.add(v)
    seen=set();after=[]
    for v in reversed(a):after.append('1' if v in seen else '0');seen.add(v)
    return ''.join(before)+'\n'+''.join(reversed(after))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
