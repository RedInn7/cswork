def solve(raw):
    from collections import Counter
    d=list(map(int,raw.split()));n,q=d[:2];counts=Counter(d[2:2+n]);total=sum(d[2:2+n]);out=[]
    for old,new in zip(d[2+n::2],d[3+n::2]):
        if old!=new:
            c=counts.pop(old,0);total+=(new-old)*c;counts[new]=c
        out.append(str(total))
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
