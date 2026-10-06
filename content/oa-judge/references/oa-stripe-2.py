def solve(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    cursor = 0
    n = int(lines[cursor]); cursor += 1
    transactions = [tuple([parts[0], int(parts[1]), parts[2], int(parts[3])])
                    for parts in (lines[cursor + i].split(",") for i in range(n))]
    cursor += n
    rules = [tuple(map(int, lines[cursor + i].split(","))) for i in range(n)]
    cursor += n
    m = int(lines[cursor]); cursor += 1
    merchants = {}
    for line in lines[cursor:cursor + m]:
        merchant, base = line.split(",")
        merchants[merchant] = int(base)
    scores = dict(merchants)

    # Pass 1: amount multipliers.
    for (merchant, amount, _customer, _hour), (threshold, multiplier, _additive, _penalty) in zip(transactions, rules):
        if amount > threshold:
            scores[merchant] *= multiplier

    # Pass 2: lifetime customer/merchant frequency. At the third occurrence,
    # the source example applies the first three additive factors retroactively.
    lifetime = {}
    for index, (merchant, _amount, customer, _hour) in enumerate(transactions):
        lifetime.setdefault((merchant, customer), []).append(index)
    for (merchant, _customer), indexes in lifetime.items():
        if len(indexes) >= 3:
            scores[merchant] += sum(rules[index][2] for index in indexes[:3])
            scores[merchant] += sum(rules[index][2] for index in indexes[3:])

    # Pass 3: same-hour frequency and applicable penalties.
    per_hour = {}
    for index, (merchant, _amount, customer, hour) in enumerate(transactions):
        per_hour.setdefault((merchant, customer, hour), []).append(index)
    for (merchant, _customer, hour), indexes in per_hour.items():
        if len(indexes) < 3:
            continue
        total_penalty = sum(rules[index][3] for index in indexes)
        if 12 <= hour <= 17:
            scores[merchant] += total_penalty
        elif 9 <= hour <= 11 or 18 <= hour <= 21:
            scores[merchant] -= total_penalty

    return "\n".join([str(len(scores))] + [f"{merchant},{scores[merchant]}" for merchant in sorted(scores)])
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
