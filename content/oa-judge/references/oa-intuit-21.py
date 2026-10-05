import sys

def solve(text):
    s = text.strip()
    ones = [0] * 26
    parity_count = [1, 0]
    prefix_count = [0] * 26
    mask = 0
    total_odd_letters = 0
    odd_length_substrings = 0
    prefix_index = 0
    for ch in s:
        mask ^= 1 << (ord(ch) - 97)
        prefix_index += 1
        for bit in range(26):
            total_odd_letters += prefix_count[bit] if not (mask >> bit) & 1 else prefix_index - prefix_count[bit]
        prefix_count = [prefix_count[bit] + (((mask >> bit) & 1) == 1) for bit in range(26)]
        parity = prefix_index & 1
        odd_length_substrings += parity_count[1 - parity]
        parity_count[parity] += 1
    return str((total_odd_letters - odd_length_substrings) // 2)

if __name__ == "__main__": print(solve(sys.stdin.read()))
