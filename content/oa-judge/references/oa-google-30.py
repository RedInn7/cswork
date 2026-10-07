import sys

def score(value):
    digits = str(value)
    presses = len(digits)
    for i in range(1, len(digits)):
        if digits[i] != digits[i - 1]:
            presses += 2
    if len(digits) <= 2:
        seconds = value
    else:
        seconds = int(digits[:-2]) * 60 + int(digits[-2:])
    return presses, seconds

def solve(raw):
    data = raw.split()
    if len(data) != 1:
        raise ValueError("expected one targetTime")
    target = int(data[0])
    if not 0 <= target <= 6039:
        raise ValueError("targetTime outside the site-supported range")
    best_key = None
    best_value = -1
    for value in range(10000):
        presses, actual = score(value)
        difference = abs(actual - target)
        if difference * 10 > target:
            continue
        key = (presses, difference, value)
        if best_key is None or key < best_key:
            best_key, best_value = key, value
    if best_value < 0:
        raise AssertionError("every target in [0, 6039] has an exact four-digit-or-shorter input")
    return str(best_value)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
