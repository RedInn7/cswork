import threading


class ZeroEvenOdd:
    """No synchronization: each thread emits its own numbers straight away."""

    def __init__(self, n: int):
        self.n = n

    def zero(self, emit):
        for _ in range(self.n):
            emit(0)

    def even(self, emit):
        for i in range(2, self.n + 1, 2):
            emit(i)

    def odd(self, emit):
        for i in range(1, self.n + 1, 2):
            emit(i)


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
        trio, log = ZeroEvenOdd(int(data[2 + r])), []

        def worker(k, own):
            def emit(x):
                pause(own)
                log.append(x)
                pause(own)

            pause(own)
            (trio.zero, trio.even, trio.odd)[k](emit)

        threads = [threading.Thread(target=worker, args=(k, random.Random(rng.random()))) for k in range(3)]
        rng.shuffle(threads)
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        out.append(" ".join(map(str, log)))
    print("\n".join(out))


main()
