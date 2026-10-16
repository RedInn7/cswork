import threading


class InOrder:
    """No synchronization: each job runs as soon as its thread gets here."""

    def first(self, job):
        job()

    def second(self, job):
        job()

    def third(self, job):
        job()


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
        words = data[2 + 3 * r : 5 + 3 * r]
        order, log = InOrder(), []

        def worker(step, word, own):
            def job():
                pause(own)
                log.append(word)
                pause(own)

            pause(own)
            (order.first, order.second, order.third)[step](job)

        threads = [threading.Thread(target=worker, args=(k, words[k], random.Random(rng.random()))) for k in range(3)]
        rng.shuffle(threads)
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        out.append(" ".join(log))
    print("\n".join(out))


main()
