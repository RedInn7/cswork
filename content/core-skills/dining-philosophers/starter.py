import threading


class DiningTable:
    """哲学家就餐 / Dining philosophers: n at a round table, fork p between philosopher p and p + 1."""

    def __init__(self, n: int):
        self.n = n
        # TODO: 需要的同步工具 / the synchronization you need

    def dine(self, p, pick, eat, drop):
        # TODO: 拿起叉子 p 和 (p + 1) % n，吃一次，再放下这两把叉子
        #       pick up forks p and (p + 1) % n, eat once, then put both down
        pass


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import os
import random
import sys
import threading
import time


def pause(rng):
    r = rng.random()
    if r < 0.4:
        time.sleep(0)
    elif r < 0.45:
        time.sleep(0.00005)


def main():
    it = iter(sys.stdin.read().split())
    rng = random.Random(int(next(it)))
    sys.setswitchinterval(1e-5)
    out = []
    for r in range(int(next(it))):
        n = int(next(it))
        wanted = [int(next(it)) for _ in range(n)]
        table, guard = DiningTable(n), threading.Lock()
        holder, meals = [-1] * n, [0] * n

        def fail(message):
            sys.stdout.write("\n".join(out + [f"round {r + 1}: {message}"]) + "\n")
            sys.stdout.flush()
            os._exit(0)

        def philosopher(p, own):
            forks = (p, (p + 1) % n)

            def pick(f):
                pause(own)
                with guard:
                    if f not in forks:
                        fail(f"philosopher {p} picked up fork {f}, which is not next to them")
                    if holder[f] != -1:
                        fail(f"philosopher {p} picked up fork {f} while philosopher {holder[f]} held it")
                    holder[f] = p
                pause(own)

            def eat():
                with guard:
                    if holder[forks[0]] != p or holder[forks[1]] != p:
                        fail(f"philosopher {p} ate without holding forks {forks[0]} and {forks[1]}")
                    meals[p] += 1
                pause(own)

            def drop(f):
                pause(own)
                with guard:
                    if holder[f] != p:
                        fail(f"philosopher {p} put down fork {f} without holding it")
                    holder[f] = -1

            for _ in range(wanted[p]):
                pause(own)
                before = meals[p]
                table.dine(p, pick, eat, drop)
                with guard:
                    if meals[p] != before + 1:
                        fail(f"philosopher {p} ate {meals[p] - before} times in one dine call")
                    if p in (holder[forks[0]], holder[forks[1]]):
                        fail(f"philosopher {p} left the table holding a fork")

        threads = [threading.Thread(target=philosopher, args=(p, random.Random(rng.random()))) for p in range(n)]
        rng.shuffle(threads)
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        out.append(" ".join(map(str, meals)))
    print("\n".join(out))


main()
