from collections import Counter

def digital_root(text):
    digit_sum = sum(ord(ch) - ord("0") for ch in text)
    if digit_sum == 0:
        return 0
    return 1 + (digit_sum - 1) % 9

def sum_digits_until_one(numbers):
    roots = [digital_root(text) for text in numbers]
    counts = Counter(roots)
    maximum_frequency = max(counts.values())
    # Site contract: if several roots are modes, return the largest one.
    return max(root for root, frequency in counts.items()
               if frequency == maximum_frequency)

def solve(raw):
    data = raw.split()
    if not data:
        raise ValueError("expected list length and numeric strings")
    n = int(data[0])
    if not 1 <= n <= 200000 or len(data) != n + 1:
        raise ValueError("site limit: 1 <= n <= 200000")
    values = data[1:]
    if any(not value or any(ch < "0" or ch > "9" for ch in value)
           or len(value) > 100000 for value in values):
        raise ValueError("site contract: non-negative decimal strings")
    if sum(map(len, values)) > 2000000:
        raise ValueError("site limit: total digit count <= 2000000")
    return str(sum_digits_until_one(values))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
