def solve(d):
    n,m=map(int,d[:2]);places=set(map(int,d[2:2+n]))
    for i in range(2+n,len(d),2):None;places.add(int(d[i+1]))
    return ' '.join(map(str,sorted(places)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
