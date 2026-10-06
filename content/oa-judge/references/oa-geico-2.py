from collections import OrderedDict
import sys

def solve(raw):
    lines = raw.strip().splitlines()
    if not lines or not lines[0].startswith("capacity="):
        raise ValueError("expected capacity=N")
    capacity = int(lines[0].split("=", 1)[1])
    if capacity <= 0:
        raise ValueError("capacity must be positive")
    cache = OrderedDict()
    output = []
    for line in lines[1:]:
        line = line.strip()
        if line.startswith("put(") and line.endswith(")"):
            key, value = map(int, line[4:-1].split(","))
            cache[key] = value
            cache.move_to_end(key)
            if len(cache) > capacity:
                cache.popitem(last=False)
        elif line.startswith("get(") and line.endswith(")"):
            key = int(line[4:-1])
            if key not in cache:
                output.append("-1")
            else:
                cache.move_to_end(key)
                output.append(str(cache[key]))
        else:
            raise ValueError("invalid operation: " + line)
    return "\n".join(output)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
