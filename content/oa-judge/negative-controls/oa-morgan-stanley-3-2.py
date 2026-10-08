import sys

def solve(raw):
    pattern, text = raw.split()
    one = two = three = 0
    for ch in text:
        if ch == pattern[2]:
            three += two
        if ch == pattern[1]:
            two += one
        if ch == pattern[0]:
            one += 1
    return str((three + 2147483648) % 4294967296 - 2147483648)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
