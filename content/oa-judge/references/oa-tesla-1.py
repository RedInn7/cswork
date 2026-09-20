def solve(d):
    return ''.join(chr(65+(ord(c)-65+4)%26) for c in d[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
