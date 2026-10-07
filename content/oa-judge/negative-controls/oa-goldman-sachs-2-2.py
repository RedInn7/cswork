import sys

def solve(raw):
    s = raw.strip()
    counts = [0] * 26
    i = 0
    while i < len(s):
        letter = ord(s[i]) - ord('a')
        i += 1
        frequency = 0
        while i < len(s) and '0' <= s[i] <= '9':
            frequency = frequency * 10 + ord(s[i]) - ord('0')
            i += 1
        counts[letter] += frequency
    return ''.join(chr(ord('a') + j) + str(counts[j]) for j in range(25, -1, -1) if counts[j])

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
