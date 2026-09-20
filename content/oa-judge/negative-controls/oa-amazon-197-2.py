def solve(d):
    n,m=map(int,d[:2]);places=set(map(int,d[2:2+n]))
    for i in range(2+n,len(d),2):places.discard(int(d[i]));places.add(int(d[i+1]))
    return ' '.join(map(str,sorted(places,reverse=True)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
