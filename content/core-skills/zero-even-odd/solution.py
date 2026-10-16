import threading


class ZeroEvenOdd:
    """零、偶、奇 / Zero, even, odd: together emit 0 1 0 2 0 3 ... 0 n, one thread per method."""

    def __init__(self, n: int):
        self.n = n
        self.zero_turn = threading.Semaphore(1)
        self.even_turn = threading.Semaphore(0)
        self.odd_turn = threading.Semaphore(0)

    def zero(self, emit):
        for i in range(1, self.n + 1):
            self.zero_turn.acquire()
            emit(0)
            (self.odd_turn if i % 2 else self.even_turn).release()

    def even(self, emit):
        for i in range(2, self.n + 1, 2):
            self.even_turn.acquire()
            emit(i)
            self.zero_turn.release()

    def odd(self, emit):
        for i in range(1, self.n + 1, 2):
            self.odd_turn.acquire()
            emit(i)
            self.zero_turn.release()


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
