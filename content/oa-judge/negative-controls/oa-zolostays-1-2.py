import sys

def count_range_sum(arr, lower, upper):
    prefix = [0]
    for value in arr:
        prefix.append(prefix[-1] + value)
    scratch = [0] * len(prefix)

    def sort_count(lo, hi):
        if hi - lo <= 1:
            return 0
        mid = (lo + hi) // 2
        count = sort_count(lo, mid) + sort_count(mid, hi)
        left_bound = right_bound = mid
        for i in range(lo, mid):
            while left_bound < hi and prefix[left_bound] - prefix[i] < lower:
                left_bound += 1
            while right_bound < hi and prefix[right_bound] - prefix[i] < upper:
                right_bound += 1
            count += right_bound - left_bound
        i, j, k = lo, mid, lo
        while i < mid and j < hi:
            if prefix[i] <= prefix[j]:
                scratch[k] = prefix[i]
                i += 1
            else:
                scratch[k] = prefix[j]
                j += 1
            k += 1
        while i < mid:
            scratch[k] = prefix[i]
            i += 1
            k += 1
        while j < hi:
            scratch[k] = prefix[j]
            j += 1
            k += 1
        prefix[lo:hi] = scratch[lo:hi]
        return count

    return sort_count(0, len(prefix))

def solve(raw):
    tokens = list(map(int, raw.split()))
    if not tokens:
        raise ValueError("missing n")
    n = tokens[0]
    if not 1 <= n <= 50000 or len(tokens) != n + 3:
        raise ValueError("site protocol: 1 <= n <= 50000, n values, lower, upper")
    arr = tokens[1:n + 1]
    lower, upper = tokens[n + 1:]
    if any(not -(2**31) <= value < 2**31 for value in arr + [lower, upper]):
        raise ValueError("array values and bounds must be signed 32-bit integers")
    if lower > upper:
        raise ValueError("lower must not exceed upper")
    return str(count_range_sum(arr, lower, upper))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
