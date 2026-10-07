# 恰好在服务完成时仍视为占用
import sys
from collections import deque

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        raise ValueError("expected n and arrival times")
    n, arrivals = data[0], data[1:]
    if not 1 <= n <= 200000 or len(arrivals) != n:
        raise ValueError("site input requires 1 <= n <= 200000 arrivals")
    if any(x < 0 or x > 10**9 for x in arrivals):
        raise ValueError("arrival time must be in [0, 10^9]")
    if any(arrivals[i] > arrivals[i + 1] for i in range(n - 1)):
        raise ValueError("arrival times must be non-decreasing")
    # A finish time equal to a's arrival has already left the system.
    active_finish_times = deque()
    result = []
    for arrival in arrivals:
        while active_finish_times and active_finish_times[0] < arrival:
            active_finish_times.popleft()
        # Source rule says reject only when current occupancy is > 10;
        # therefore at most 11 people may be in the system after admission.
        if len(active_finish_times) > 10:
            result.append("null")
            continue
        start = max(arrival, active_finish_times[-1] if active_finish_times else arrival)
        result.append(str(start))
        active_finish_times.append(start + 30)
    return " ".join(result)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
