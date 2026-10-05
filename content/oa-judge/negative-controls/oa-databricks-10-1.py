def solve(data):
    n=int(data); row=''.join(['*']*n); return '\n'.join([row]*n)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
