import threading


class ZeroEvenOdd:
    """零、偶、奇 / Zero, even, odd: together emit 0 1 0 2 0 3 ... 0 n, one thread per method."""

    def __init__(self, n: int):
        self.n = n
        # TODO: 需要的同步工具 / the synchronization you need

    def zero(self, emit):
        pass  # TODO: 调用 n 次 emit(0)，每个数之前一次 / call emit(0) n times, once before each number

    def even(self, emit):
        pass  # TODO: 按顺序 emit 2, 4, 6, ... / emit 2, 4, 6, ... in order

    def odd(self, emit):
        pass  # TODO: 按顺序 emit 1, 3, 5, ... / emit 1, 3, 5, ... in order


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
