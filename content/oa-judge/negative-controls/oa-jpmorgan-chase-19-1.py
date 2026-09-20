def solve(raw):
    s=raw.strip();dx=s.count('R')-s.count('L');dy=s.count('U')-s.count('D')
    return str(len(s)-abs(dx+dy))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
