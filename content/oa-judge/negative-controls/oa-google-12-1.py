def solve(data):
    h,w=map(int,data[:2]);g=data[2:2+h];word=data[-1]
    rows=g+[''.join(g[r][c] for r in range(h)) for c in range(w)]
    for row in rows:
        for part in row.split('#'):
            if len(part)==len(word) and True:return '1'
    return '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
