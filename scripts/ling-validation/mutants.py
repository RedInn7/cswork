"""Authored common mistakes, serialized as data and executed only in go-judge."""

MUTANTS = {
    3: ('counts all distinct characters instead of a contiguous substring',
        "s = input(); print(len(set(s)))"),
    11: ('checks only adjacent containers',
         "v = list(map(int, input().split())); a = list(map(int, input().split())); print(max(min(a[i], a[i+1]) for i in range(len(a)-1)))"),
    35: ('uses upper bound instead of lower bound',
         "from bisect import bisect_right\nn, target = map(int, input().split()); a = list(map(int, input().split())); print(bisect_right(a, target))"),
    53: ('allows an empty maximum subarray',
         "n = int(input()); a = list(map(int, input().split())); best = current = 0\nfor x in a:\n    current = max(0, current + x); best = max(best, current)\nprint(best)"),
    121: ('allows unlimited stock transactions',
          "n = int(input()); a = list(map(int, input().split())); print(sum(max(0, y-x) for x,y in zip(a, a[1:])))"),
    198: ('chooses only odd or even indexed houses',
          "n = int(input()); a = list(map(int, input().split())); print(max(sum(a[::2]), sum(a[1::2])))"),
    209: ('requires a sum strictly greater than target',
          "n, target = map(int, input().split()); a = list(map(int, input().split())); left = total = 0; best = n+1\nfor right, value in enumerate(a):\n    total += value\n    while total > target:\n        best = min(best, right-left+1); total -= a[left]; left += 1\nprint(0 if best == n+1 else best)"),
    322: ('greedily takes the largest available denomination',
          "n, amount = map(int, input().split()); coins = sorted(map(int, input().split()), reverse=True); count = 0\nfor coin in coins:\n    count += amount // coin; amount %= coin\nprint(-1 if amount else count)"),
    69: ('rounds the square root instead of flooring it',
         "from math import sqrt\nprint(round(sqrt(int(input()))))"),
    1456: ('checks only the first window',
           "s = input(); k = int(input()); print(sum(c in 'aeiou' for c in s[:k]))"),
}


def for_problem(pid):
    name, source = MUTANTS[pid]
    return [{'name': name, 'source': source + '\n'}]
