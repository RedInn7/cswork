# 提现成功后立即发放返现
import heapq, json
def solve(raw):
    t = raw.split(); n, q = map(int, t[:2]); b = list(map(int, t[2:2+n])); p=[]; at=2+n
    for i in range(1, q+1):
        op, ts, account, amount = t[at], *map(int, t[at+1:at+4]); at += 4
        while p and p[0][0] <= ts:
            _, idx, value = heapq.heappop(p); b[idx] += value
        if account < 1 or account > n: return json.dumps([-i], separators=(",", ":"))
        idx=account-1
        if op == "deposit": b[idx] += amount
        else:
            if b[idx] < amount: return json.dumps([-i], separators=(",", ":"))
            b[idx] -= amount; b[idx] += amount*2//100  # Bug: cashback is not immediate.
    return json.dumps(b, separators=(",", ":"))

if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
