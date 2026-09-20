def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return '\n'.join(str(v.bit_length()-1+v.bit_count() if v else 1) for v in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
