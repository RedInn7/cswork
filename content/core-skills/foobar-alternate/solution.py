import threading


class FooBar:
    """交替输出 / Take turns: foo and bar each call emit n times, foo first, strictly alternating."""

    def __init__(self, n: int):
        self.n = n
        self.foo_turn = threading.Semaphore(1)
        self.bar_turn = threading.Semaphore(0)

    def foo(self, emit):
        for _ in range(self.n):
            self.foo_turn.acquire()
            emit()
            self.bar_turn.release()

    def bar(self, emit):
        for _ in range(self.n):
            self.bar_turn.acquire()
            emit()
            self.foo_turn.release()


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
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
    data = sys.stdin.read().split()
    rng = random.Random(int(data[0]))
    sys.setswitchinterval(1e-5)
    out = []
    for r in range(int(data[1])):
        n, words = int(data[2 + 3 * r]), data[3 + 3 * r : 5 + 3 * r]
        pair, log = FooBar(n), []

        def worker(side, own):
            def emit():
                pause(own)
                log.append(words[side])
                pause(own)

            pause(own)
            (pair.foo, pair.bar)[side](emit)

        threads = [threading.Thread(target=worker, args=(k, random.Random(rng.random()))) for k in range(2)]
        rng.shuffle(threads)
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        out.append(" ".join(log))
    print("\n".join(out))


main()
