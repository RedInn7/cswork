def solve(raw):
    lines = raw.splitlines()
    message, n = lines[0], int(lines[1])
    vowels = set("aeiouAEIOU")
    consonants = "bcdfghjklmnpqrstvwxyz"
    count = 0
    out = []
    for char in message:
        lower = char.lower()
        if "a" <= lower <= "z" and char not in vowels:
            count += 1
            if count % n == 0:
                shifted = consonants[(consonants.index(lower) + 1) % len(consonants)]
                out.append(shifted.upper() if char.isupper() else shifted)
                continue
        out.append(char)
    return "".join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
