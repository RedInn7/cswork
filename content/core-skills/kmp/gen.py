import json
import random

rng = random.Random(20261025)


def text(t, p):
    return f"{t}\n{p}\n"


def word(n, alphabet):
    return "".join(rng.choice(alphabet) for _ in range(n))


def planted(n, p, alphabet, count):
    """Random text over a small alphabet with p copied in at random places."""
    t = list(word(n, alphabet))
    for _ in range(count):
        at = rng.randrange(n - len(p) + 1)
        t[at:at + len(p)] = p
    return "".join(t)


p1 = word(6, "ab")
p2 = "abaabaabab"
print(json.dumps({
    "samples": [text("abababa", "aba")],
    "tests": [text("a", "a"), text("ab", "b"), text("abc", "d"), text("aaaaaaaaaa", "aaa"), text("abcabcabd", "abcabd"),
              text("aabaaab", "aab"), text(planted(200, p1, "ab", 20), p1), text(planted(5000, p2, "ab", 300), p2),
              text("a" * 10000, "a" * 1000), text(planted(30000, "abcab", "abc", 2000), "abcab"),
              text(word(30000, "xyz"), "zzzzzzzzzzzzzzzzzzzzzzzzzzz"), text("ab" * 15000, "ab" * 200 + "b")],
}))
