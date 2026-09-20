def solve(raw):
    a=sorted(map(int,raw.split()[1:]));best=max(y-x for x,y in zip(a,a[1:]))
    pairs=[f'{x} {y}' for x,y in zip(a,a[1:]) if y-x==best]
    return '\n'.join(pairs)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
