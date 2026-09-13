def solve(d):
    n,x=map(int,d[:2]); factor=list(map(int,d[2:2+n])); pos=2+n; candidates=[]
    for limit in factor:
        row=sorted(map(int,d[pos:pos+n]),reverse=True); pos+=n; candidates.extend(row)
    if len(candidates)<x: return '-1'
    candidates.sort(reverse=True)
    return str(sum(candidates[:x]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
