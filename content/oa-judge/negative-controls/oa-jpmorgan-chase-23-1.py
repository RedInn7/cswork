def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return '\n'.join(str(v.bit_length() if v else 0) for v in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
