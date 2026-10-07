import sys

def solve(raw):
    n = int(raw.strip())
    digits = []
    first_position = {}
    remainder = 1
    while remainder != 0 and remainder not in first_position:
        first_position[remainder] = len(digits)
        remainder *= 10
        digits.append(str(remainder // n))
        remainder %= n
    if remainder == 0:
        prefix = "".join(digits)
        cycle = "0"
    else:
        start = first_position[remainder]
        prefix = "".join(digits[:start])
        cycle = "".join(digits[start:])
    return f"0.{prefix}{cycle} {cycle}"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
