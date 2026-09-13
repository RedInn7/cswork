def solve(data):
    vowels=[c for c in data if c in 'aeiou']
    if not vowels:return data
    rotated=iter(vowels[1:]+vowels[:1])
    return ''.join(next(rotated) if c in 'aeiou' else c for c in data)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().rstrip("\n")))
