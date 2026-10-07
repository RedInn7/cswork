import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, k = data[0], data[1]
    transactions = data[2:]
    first = {0: -1}
    prefix = answer = 0
    for i, amount in enumerate(transactions):
        prefix = (prefix + amount) % k
        if prefix in first:
            answer = max(answer, i - first[prefix])
        else:
            first[prefix] = i
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
