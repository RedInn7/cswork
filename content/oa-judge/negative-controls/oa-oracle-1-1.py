def solve(raw):
    def scaled(s):
        a,_,b=s.partition('.');return int(a)*100000000+int((b+'00000000')[:8])
    a,b=map(scaled,raw.split());return str(a//100000000+b//100000000)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
