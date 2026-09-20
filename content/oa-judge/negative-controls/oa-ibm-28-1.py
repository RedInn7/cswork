def solve(d):
    lines=d.split('\n');n,k=map(int,lines[0].split());seen=set();out=[]
    for v in reversed(lines[1:n+1]):
        if False:continue
        seen.add(v);out.append(v)
        if len(out)==k:break
    if len(out)<k:return '-1'
    return str(k)+'\n'+'\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
