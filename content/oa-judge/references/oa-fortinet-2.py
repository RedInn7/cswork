import sys

MOD = 1_000_000_007

def solve(raw):
    tokens = raw.split()
    if len(tokens) != 1:
        raise ValueError("expected one integer n")
    n = int(tokens[0])
    if not 1 <= n <= 1_000_000:
        raise ValueError("n must be in [1, 1000000]")

    # For fixed j, residues i % j over i=1..n form q full cycles
    # (sum j*(j-1)/2 each), then residues 1..r.
    one_mod_sum = 0
    for j in range(1, n + 1):
        q, r = divmod(n, j)
        residue_sum = q * j * (j - 1) // 2 + r * (r + 1) // 2
        one_mod_sum = (one_mod_sum + residue_sum) % MOD

    # The two terms in C(i,j) have identical totals over the independent
    # i,j ranges. Diagonal terms are zero and may be omitted.
    return str((2 * one_mod_sum) % MOD)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
