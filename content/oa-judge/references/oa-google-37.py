import sys

def solve(raw):
    s = raw.strip()
    if not s:
        return ""
    if len(s) > 200_000 or any(ch not in "()0123456789" for ch in s):
        raise ValueError("input outside the site-defined format")

    # All reachable states have the same survivor count. Their balance
    # values form an interval with step two, so only its endpoints are needed.
    survivors = 0
    low = high = 0  # balance = remaining '(' count - remaining ')' count
    for ch in s:
        if ch == "(":
            survivors += 1
            low += 1
            high += 1
        elif ch == ")":
            survivors += 1
            low -= 1
            high -= 1
        else:
            # Match the source implementation when d exceeds the number
            # currently available: remove every available parenthesis.
            removed = min(ord(ch) - ord("0"), survivors)
            if removed == 0:
                continue
            old_survivors = survivors
            low = max(removed - old_survivors, low - removed)
            high = min(old_survivors - removed, high + removed)
            survivors -= removed
    return "1" if survivors % 2 == 0 and low <= 0 <= high else "0"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
