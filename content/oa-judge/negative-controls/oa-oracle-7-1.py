def solve(raw):
    a=map(int,raw.split()[1:]);return ' '.join(str(int((v&(v-1))==0)) for v in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
