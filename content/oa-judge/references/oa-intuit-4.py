import sys
MOD = 1_000_000_007

def solve(raw):
    n = int(raw.strip())
    if not 1 <= n <= 10**18:
        raise ValueError("site protocol: 1 <= n <= 10^18")
    # Inclusion-exclusion over the three monochromatic-column events.
    return str((pow(24, n, MOD) - 9 * pow(8, n, MOD)
                + 9 * pow(2, n, MOD) + 18 * pow(3, n, MOD) - 24) % MOD)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
