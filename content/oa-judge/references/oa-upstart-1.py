def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; xs=v[1::2][:n]; ys=v[2::2][:n]
    return f"{min(xs)} {min(ys)} {max(xs)-min(xs)} {max(ys)-min(ys)}"

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
