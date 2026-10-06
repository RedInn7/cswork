import heapq
import json
import sys

DAY_SECONDS = 86_400

def solve(raw):
    tokens = raw.split()
    if len(tokens) < 2:
        raise ValueError("expected account and request counts")
    n, q = int(tokens[0]), int(tokens[1])
    if not (1 <= n <= 100_000 and 0 <= q <= 200_000):
        raise ValueError("input exceeds station limits")
    if len(tokens) != 2 + n + 4 * q:
        raise ValueError("wrong number of input fields")
    balance = list(map(int, tokens[2:2+n]))
    if any(x < 0 or x > 1_000_000_000_000 for x in balance):
        raise ValueError("invalid initial balance")

    requests = []
    at = 2 + n
    previous_ts = 0
    for _ in range(q):
        op = tokens[at]
        ts, account, amount = map(int, tokens[at+1:at+4])
        at += 4
        if op not in ("deposit", "withdraw"):
            raise ValueError("unknown operation")
        if not (1 <= ts <= 1_000_000_000_000 and ts > previous_ts):
            raise ValueError("timestamps must be strictly increasing")
        if not (0 <= amount <= 1_000_000_000):
            raise ValueError("invalid amount")
        previous_ts = ts
        requests.append((op, ts, account, amount))

    pending = []
    for request_id, (op, ts, account, amount) in enumerate(requests, 1):
        # The statement explicitly orders due cashback before same-second work.
        while pending and pending[0][0] <= ts:
            _, index, refund = heapq.heappop(pending)
            balance[index] += refund

        if account < 1 or account > n:
            return json.dumps([-request_id], separators=(",", ":"))
        index = account - 1
        if op == "deposit":
            balance[index] += amount
        else:
            if balance[index] < amount:
                return json.dumps([-request_id], separators=(",", ":"))
            balance[index] -= amount
            refund = (amount * 2) // 100
            heapq.heappush(pending, (ts + DAY_SECONDS, index, refund))

    # Do not process refunds after the timestamp of the final request.
    return json.dumps(balance, separators=(",", ":"))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
