import threading


class H2O:
    """No synchronization: every atom bonds as soon as it arrives."""

    def hydrogen(self, bond):
        bond()

    def oxygen(self, bond):
        bond()


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
    data = sys.stdin.read().split()
    rng = random.Random(int(data[0]))
    sys.setswitchinterval(1e-5)
    out = []
    for r, atoms in enumerate(data[2 : 2 + int(data[1])]):
        water, log, guard = H2O(), [], threading.Lock()

        def fail(message):
            sys.stdout.write("\n".join(out + [f"round {r + 1}: {message}"]) + "\n")
            sys.stdout.flush()
            os._exit(0)

        def worker(atom, own):
            def bond():
                pause(own)
                with guard:
                    group = log[len(log) - len(log) % 3 :]
                    if atom == "H" and group.count("H") == 2:
                        fail(f"molecule {len(log) // 3 + 1} got a third hydrogen")
                    if atom == "O" and "O" in group:
                        fail(f"molecule {len(log) // 3 + 1} got a second oxygen")
                    log.append(atom)
                pause(own)

            pause(own)
            (water.hydrogen if atom == "H" else water.oxygen)(bond)

        threads = [threading.Thread(target=worker, args=(atom, random.Random(rng.random()))) for atom in atoms]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        if len(log) != len(atoms):
            fail(f"{len(log)} of {len(atoms)} atoms bonded")
        out.append(str(len(atoms) // 3))
    print("\n".join(out))


main()
