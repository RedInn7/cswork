import json
from collections import Counter
from fractions import Fraction

def solve_object(data):
    strings, use_jaccard = data["strings"], data["useJaccard"]
    counts = [Counter(s) for s in strings]
    n = len(strings)
    if use_jaccard:
        scores = []
        for i in range(n):
            total = Fraction(0, 1)
            for j in range(n):
                if i == j:
                    continue
                chars = counts[i].keys() | counts[j].keys()
                intersection = sum(min(counts[i][c], counts[j][c]) for c in chars)
                union = sum(max(counts[i][c], counts[j][c]) for c in chars)
                total += Fraction(intersection, union)
            scores.append(total / (n - 1))
    else:
        scores = [Fraction(max(c.values()), len(s)) for c, s in zip(counts, strings)]
    best = min(scores)
    selected = [i for i, score in enumerate(scores) if score == best]
    selected_set = set(selected)
    other_chars = set().union(*(set(strings[i]) for i in range(n) if i not in selected_set)) if len(selected) < n else set()
    answer = "".join(ch for i in selected for ch in strings[i] if ch not in other_chars)
    return answer

def solve(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or set(data) != {"strings", "useJaccard"}:
        raise ValueError("expected strings and useJaccard")
    strings, flag = data["strings"], data["useJaccard"]
    if not isinstance(strings, list) or not 2 <= len(strings) <= 80:
        raise ValueError("site limit: 2 <= number of strings <= 80")
    if type(flag) is not bool or any(not isinstance(s, str) or not 1 <= len(s) <= 1000 for s in strings):
        raise ValueError("site limit: boolean and non-empty strings of length <= 1000")
    if sum(map(len, strings)) > 10000:
        raise ValueError("site limit: total length <= 10000")
    return json.dumps(solve_object(data), ensure_ascii=False)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
