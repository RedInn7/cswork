import sys
from array import array

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    values = [next(it) for _ in range(n)]
    q = next(it)
    size = 1
    while size < n:
        size <<= 1
    nodes = size << 1
    # Pack all 20 bit counts into independent 18-bit lanes per segment node.
    lane_width = 18
    lane_mask = (1 << lane_width) - 1
    counts = [0] * nodes
    sums = [0] * nodes
    lazy = array('I', [0]) * nodes
    for i, value in enumerate(values):
        p = size + i
        sums[p] = value
        bit = 0
        while value:
            if value & 1:
                counts[p] |= 1 << (bit * lane_width)
            value >>= 1
            bit += 1
    for p in range(size - 1, 0, -1):
        l, r = p << 1, (p << 1) | 1
        sums[p] = sums[l] + sums[r]
        counts[p] = counts[l] + counts[r]

    def mask_fields(mask):
        pending = mask
        lanes = 0
        selected = 0
        bits = []
        while pending:
            flag = pending & -pending
            bit = flag.bit_length() - 1
            offset = bit * lane_width
            lanes |= 1 << offset
            selected |= lane_mask << offset
            bits.append((bit, flag, offset))
            pending -= flag
        return lanes, selected, bits

    def apply(p, length, mask, lanes, selected, bits):
        old_counts = counts[p]
        new_counts = length * lanes - (old_counts & selected)
        counts[p] = (old_counts & ~selected) | new_counts
        for bit, flag, offset in bits:
            ones = (old_counts >> offset) & lane_mask
            sums[p] += (length - 2 * ones) * flag
        lazy[p] ^= mask

    height = size.bit_length() - 1

    def push(p, level):
        pending = lazy[p]
        if pending:
            half = 1 << (level - 1)
            lanes, selected, bits = mask_fields(pending)
            apply(p << 1, half, pending, lanes, selected, bits)
            apply((p << 1) | 1, half, pending, lanes, selected, bits)
            lazy[p] = 0

    def pull(p):
        sums[p] = sums[p << 1] + sums[(p << 1) | 1]
        counts[p] = counts[p << 1] + counts[(p << 1) | 1]

    def push_boundaries(left, right):
        for level in range(height, 0, -1):
            if (left >> level) << level != left:
                push(left >> level, level)
            if (right >> level) << level != right:
                push((right - 1) >> level, level)

    def update(left, right, mask, lanes, selected, bits):
        left += size
        right += size
        left0, right0 = left, right
        push_boundaries(left0, right0)
        level = 0
        while left < right:
            if left & 1:
                apply(left, 1 << level, mask, lanes, selected, bits)
                left += 1
            if right & 1:
                right -= 1
                apply(right, 1 << level, mask, lanes, selected, bits)
            left >>= 1
            right >>= 1
            level += 1
        for level in range(1, height + 1):
            if (left0 >> level) << level != left0:
                pull(left0 >> level)
            if (right0 >> level) << level != right0:
                pull((right0 - 1) >> level)

    def query(left, right):
        left += size
        right += size
        push_boundaries(left, right)
        total = 0
        while left < right:
            if left & 1:
                total += sums[left]
                left += 1
            if right & 1:
                right -= 1
                total += sums[right]
            left >>= 1
            right >>= 1
        return total

    answers = []
    for _ in range(q):
        typ = next(it)
        left, right = next(it) - 1, next(it) - 1
        if typ == 1:
            answers.append(str(query(left, right + 1)))
        else:
            xor_mask = next(it)
            lanes, selected, bits = mask_fields(xor_mask)
            update(left, right + 1, xor_mask, lanes, selected, bits)
    return '\n'.join(answers) + ('\n' if answers else '')

if __name__ == '__main__':
    print(solve(sys.stdin.read()), end='')
