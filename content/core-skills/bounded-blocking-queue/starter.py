import collections
import threading


class BoundedBlockingQueue:
    """有界阻塞队列 / Bounded blocking queue: FIFO, at most capacity items; put waits when full, take when empty."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.items = collections.deque()
        # TODO: 锁和条件变量 / a lock and condition variables

    def put(self, x: int) -> None:
        pass  # TODO: 队列满时等待，然后放到队尾 / wait while full, then append x

    def take(self) -> int:
        return -1  # TODO: 队列空时等待，然后取出队头 / wait while empty, then remove the head


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
        capacity, producers, consumers, k = (int(next(it)) for _ in range(4))
        total = producers * k
        queue, guard = BoundedBlockingQueue(capacity), threading.Lock()
        started, taken = [False] * (total + 1), [False] * (total + 1)
        # Puts returned, takes begun, takes returned, and the sum of what came out.
        count = {"put": 0, "take": 0, "done": 0, "sum": 0}

        def fail(message):
            sys.stdout.write("\n".join(out + [f"round {r + 1}: {message}"]) + "\n")
            sys.stdout.flush()
            os._exit(0)

        def producer(i, own):
            for x in range(i * k + 1, i * k + k + 1):
                pause(own)
                with guard:
                    started[x] = True
                queue.put(x)
                with guard:
                    count["put"] += 1
                    # At least put - take items are inside the queue right now.
                    if count["put"] - count["take"] > capacity:
                        fail(f"the queue went over its capacity of {capacity}")

        def consumer(j, own):
            last = [0] * producers  # the last item this consumer took from each producer
            if own.random() < 0.5:
                time.sleep(0.001)  # let the producers run ahead
            for _ in range(total // consumers + (j < total % consumers)):
                pause(own)
                with guard:
                    count["take"] += 1
                x = queue.take()
                with guard:
                    if type(x) is not int or not 1 <= x <= total or not started[x]:
                        fail(f"take() returned {x}, which was never put")
                    if taken[x]:
                        fail(f"{x} was taken twice")
                    p = (x - 1) // k
                    if x < last[p]:
                        fail(f"{x} came out after {last[p]}, though it was put first")
                    taken[x], last[p] = True, x
                    count["done"] += 1
                    count["sum"] += x

        threads = [threading.Thread(target=producer, args=(i, random.Random(rng.random()))) for i in range(producers)]
        threads += [threading.Thread(target=consumer, args=(j, random.Random(rng.random()))) for j in range(consumers)]
        rng.shuffle(threads)
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        if count["done"] != total:
            fail(f"only {count['done']} of {total} items came out")
        out.append(f"{total} {count['sum']}")
    print("\n".join(out))


main()
