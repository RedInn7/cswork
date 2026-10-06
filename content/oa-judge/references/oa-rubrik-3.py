import sys
def solve(raw):
    s=raw.strip('\n')
    vowels=set('aeiouAEIOU')
    return str(sum(1 for w in s.split() if len(w)>=3 and w.isascii() and w.isalnum() and any(c in vowels for c in w) and any(c.isalpha() and c not in vowels for c in w)))
if __name__ == '__main__': print(solve(sys.stdin.read()))
