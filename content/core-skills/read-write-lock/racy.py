import threading


class RWLock:
    """Writers exclude each other, but readers never take the lock."""

    def __init__(self):
        self.write_lock = threading.Lock()

    def acquire_read(self):
        pass

    def release_read(self):
        pass

    def acquire_write(self):
        self.write_lock.acquire()

    def release_write(self):
        self.write_lock.release()


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
    out, failing = [], threading.Lock()
    for r in range(int(next(it))):
        kind, lock, guard = next(it), RWLock(), threading.Lock()

        def fail(message):
            failing.acquire()
            sys.stdout.write("\n".join(out + [f"round {r + 1}: {message}"]) + "\n")
            sys.stdout.flush()
            os._exit(0)

        def run(workers):
            threads = [threading.Thread(target=work, args=(random.Random(rng.random()),)) for work in workers]
            rng.shuffle(threads)
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        if kind == "hold":
            # While the driver holds the lock, threads that try to get in must stay out.
            entered = []

            def probe(acquire, release):
                def work():
                    acquire()
                    entered.append(1)
                    release()

                thread = threading.Thread(target=work)
                thread.start()
                return thread

            def kept_out(message):
                deadline = time.monotonic() + 0.1
                while not entered and time.monotonic() < deadline:
                    time.sleep(0.001)
                if entered:
                    fail(message)

            lock.acquire_write()
            waiting = [probe(lock.acquire_read, lock.release_read), probe(lock.acquire_write, lock.release_write)]
            kept_out("a thread got in while the write lock was held")
            lock.release_write()
            for t in waiting:
                t.join()
            entered.clear()
            lock.acquire_read()
            waiting = probe(lock.acquire_write, lock.release_write)
            kept_out("a writer got in while a read lock was held")
            lock.release_read()
            waiting.join()
            out.append("held")
        elif kind == "share":
            # Every reader must be able to hold the read lock at once.
            n = int(next(it))
            together = threading.Barrier(n)

            def reader(own):
                pause(own)
                lock.acquire_read()
                try:
                    together.wait(timeout=2)
                except threading.BrokenBarrierError:
                    fail(f"{n} readers could not hold the read lock at the same time")
                lock.release_read()

            run([reader] * n)
            out.append(str(n))
        else:
            readers, writers, ops = int(next(it)), int(next(it)), int(next(it))
            values = [int(next(it)) for _ in range(writers)]
            data = [0, 0]  # a writer adds its value to both; a reader must never see them differ
            inside = {"readers": 0, "writers": 0}

            def reader(own):
                for _ in range(ops):
                    pause(own)
                    lock.acquire_read()
                    with guard:
                        if inside["writers"]:
                            fail("a reader got in while a writer held the lock")
                        inside["readers"] += 1
                    a = data[0]
                    pause(own)
                    b = data[1]
                    if a != b:
                        fail(f"a reader saw a half-done write ({a} and {b})")
                    with guard:
                        inside["readers"] -= 1
                    lock.release_read()

            def writer(v):
                def work(own):
                    for _ in range(ops):
                        pause(own)
                        lock.acquire_write()
                        with guard:
                            if inside["writers"] or inside["readers"]:
                                fail("a writer got in while another thread held the lock")
                            inside["writers"] += 1
                        a = data[0]
                        pause(own)
                        data[0] = a + v
                        pause(own)
                        data[1] += v
                        with guard:
                            inside["writers"] -= 1
                        lock.release_write()

                return work

            run([reader] * readers + [writer(v) for v in values])
            out.append(str(data[0]))
    print("\n".join(out))


main()
