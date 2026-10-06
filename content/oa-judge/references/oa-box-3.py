import json
import sys

def solve(raw):
    data = json.loads(raw)
    flavors = data["flavors"]
    start = data["startIndex"]
    target = data["target"]
    if not isinstance(flavors, list) or not flavors:
        raise ValueError("flavors must be a nonempty array")
    if not isinstance(start, int) or not 0 <= start < len(flavors):
        raise ValueError("startIndex out of range")
    if target not in flavors:
        raise ValueError("target must occur in flavors")
    n = len(flavors)
    return str(min(min((i - start) % n, (start - i) % n)
                   for i, flavor in enumerate(flavors) if flavor == target))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
