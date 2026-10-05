def solve(data):
    it=iter(data.split()); n=int(next(it)); q=int(next(it)); bits=next(it); pref=[0]*(n+1)
    for i,c in enumerate(bits): pref[i+1]=pref[i]+(c=='0')
    flipped=False; out=[]
    for _ in range(q):
        op=next(it)
        if op=='flip': flipped=not flipped
        else:
            i=int(next(it)); z=pref[i+1]; out.append(str(i+1-z if flipped else z))
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
