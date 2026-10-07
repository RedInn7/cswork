import sys

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    size, bouquet_size, needed = data[:3]
    bloom = data[3:]
    if len(data) != 3 + size:
        raise ValueError("expected N, K, M, followed by N bloom days")
    if size < 1 or size > 200_000 or not 1 <= bouquet_size <= 200_000:
        raise ValueError("N and K are outside the supported range")
    if not 1 <= needed <= 200_000 or any(day < 0 or day > 1_000_000_000 for day in bloom):
        raise ValueError("M or a bloom day is outside the supported range")
    if bouquet_size * needed > size:
        return "-1"

    def possible(day):
        bouquets = run = 0
        for bloom_day in bloom:
            if bloom_day <= day:
                run += 1
                if run == bouquet_size:
                    bouquets += 1
                    run = 0
                    if bouquets >= needed:
                        return True
            else:
                run = 0
        return False

    low, high = min(bloom), max(bloom)
    while low < high:
        middle = (low + high) // 2
        if possible(middle):
            high = middle
        else:
            low = middle + 1
    return str(low)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
