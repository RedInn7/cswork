def solve(raw):
    d=iter(map(int,raw.split()));n=next(d);m=next(d);positions={next(d) for _ in range(n)}
    for _ in range(max(0,m-1)):
        u=next(d);v=next(d);positions.remove(u);positions.add(v)
    return str(len(positions))+'\n'+' '.join(map(str,sorted(positions)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
