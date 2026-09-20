def solve(raw):
    d=list(map(int,raw.split()));n,q=d[:2];a=sorted(d[2:2+n],reverse=True);prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    return ' '.join(str(prefix[k-1]) for k in d[2+n:])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
