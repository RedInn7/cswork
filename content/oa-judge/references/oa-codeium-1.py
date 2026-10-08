import sys

def solve(raw):
    words = raw.split()
    n = int(words[0])
    bound = str(n)
    p = []
    for word in words[1:]:
        digits = word.lstrip('+').lstrip('0') or '0'
        if word.startswith('-'):
            digits = word[1:].lstrip('0') or '0'
        if len(digits) > len(bound) or (len(digits) == len(bound) and digits > bound):
            return 'None'
        p.append(int(digits))
    order = sorted(range(n), key=lambda i: p[i])
    left, right, offset = 0, n - 1, 0
    a = [0] * n
    for remaining in range(n, 0, -1):
        if p[order[left]] < offset or p[order[right]] > offset + remaining:
            return 'None'
        if p[order[left]] == offset:
            a[order[left]] = -remaining
            left += 1
        elif p[order[right]] == offset + remaining:
            a[order[right]] = remaining
            right -= 1
            offset += 1
        else:
            return 'None'
    return ' '.join(map(str, a))

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
