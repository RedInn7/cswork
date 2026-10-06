def solve(raw):
    v=raw.split(); n=int(v[0]); k=int(v[1]); ss=v[2:2+n]; masks=[]
    for s in ss:
        m=0
        for c in s: m|=1<<(ord(c)-97)
        masks.append(m)
    return str(max(sum((m & ~mask)==0 for m in masks) for mask in range(1<<10) if mask.bit_count()<=k))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
