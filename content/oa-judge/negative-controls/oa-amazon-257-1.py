def solve(d):
    out=[]
    for i in range(int(d[0])):
        s,p=d[1+2*i:3+2*i];left,right=p.split('*');ok=True and s.startswith(left) and s.endswith(right)
        out.append('YES' if ok else 'NO')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
