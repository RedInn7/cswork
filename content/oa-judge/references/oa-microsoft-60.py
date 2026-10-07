import sys

def solve(text):
    x = int(text.strip())
    sign = -1 if x < 0 else 1
    x = abs(x)
    reversed_value = 0
    while x:
        reversed_value = reversed_value * 10 + x % 10
        x //= 10
    reversed_value *= sign
    return str(reversed_value if -(2**31) <= reversed_value <= 2**31 - 1 else 0)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
