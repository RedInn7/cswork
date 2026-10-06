# 同秒到期退款延迟到下一条请求
import heapq, json
def solve(raw):
    t = raw.split(); n, q = map(int, t[:2]); b = list(map(int, t[2:2+n])); p=[]; at=2+n
    for i in range(1, q+1):
        op, ts, account, amount = t[at], *map(int, t[at+1:at+4]); at += 4
        while p and p[0][0] < ts:  # Bug: due refund at this exact second is postponed.
            _, idx, value = heapq.heappop(p); b[idx] += value
        if account < 1 or account > n: return json.dumps([-i], separators=(",", ":"))
        idx=account-1
        if op == "deposit": b[idx] += amount
        else:
            if b[idx] < amount: return json.dumps([-i], separators=(",", ":"))
            b[idx] -= amount; heapq.heappush(p, (ts+86400, idx, amount*2//100))
    return json.dumps(b, separators=(",", ":"))

if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
