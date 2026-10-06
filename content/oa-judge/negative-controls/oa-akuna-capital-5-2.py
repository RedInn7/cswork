import sys
def solve(raw):
 s=raw.strip();ones=s.count('1');zeros=s.count('0');return str(ones+zeros)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
