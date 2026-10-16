import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

// Writers exclude each other, but readers never take the lock.
class RWLock {
    private final ReentrantLock write = new ReentrantLock();

    void acquireRead() throws InterruptedException {}

    void releaseRead() {}

    void acquireWrite() throws InterruptedException {
        write.lock();
    }

    void releaseWrite() {
        write.unlock();
    }
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
public class Main {
    static final StringBuilder out = new StringBuilder();
    static Random rng;

    interface Step {
        void run() throws InterruptedException;
    }

    interface Work {
        void run(Random own) throws Exception;
    }

    static void pause(Random rng) {
        double r = rng.nextDouble();
        if (r < 0.4) Thread.yield();
        else if (r < 0.45) LockSupport.parkNanos(50_000);
    }

    static synchronized void fail(int round, String message) {
        System.out.print(out + "round " + round + ": " + message + "\n");
        System.out.flush();
        Runtime.getRuntime().halt(0);
    }

    static void run(List<Work> workers) throws InterruptedException {
        List<Thread> threads = new ArrayList<>();
        for (Work work : workers) {
            Random own = new Random(rng.nextLong());
            threads.add(new Thread(() -> {
                try {
                    work.run(own);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }));
        }
        Collections.shuffle(threads, rng);
        for (Thread t : threads) t.start();
        for (Thread t : threads) t.join();
    }

    static Thread probe(Step acquire, Step release, CountDownLatch entered) {
        Thread thread = new Thread(() -> {
            try {
                acquire.run();
                entered.countDown();
                release.run();
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        });
        thread.start();
        return thread;
    }

    public static void main(String[] args) throws Exception {
        String[] in = new String(System.in.readAllBytes()).trim().split("\\s+");
        rng = new Random(Long.parseLong(in[0]));
        int at = 2;
        for (int r = 1, rounds = Integer.parseInt(in[1]); r <= rounds; r++) {
            int round = r;
            RWLock lock = new RWLock();
            switch (in[at++]) {
                case "hold" -> {
                    // While the driver holds the lock, threads that try to get in must stay out.
                    CountDownLatch entered = new CountDownLatch(1);
                    lock.acquireWrite();
                    Thread reader = probe(lock::acquireRead, lock::releaseRead, entered);
                    Thread writer = probe(lock::acquireWrite, lock::releaseWrite, entered);
                    if (entered.await(100, TimeUnit.MILLISECONDS))
                        fail(round, "a thread got in while the write lock was held");
                    lock.releaseWrite();
                    reader.join();
                    writer.join();
                    CountDownLatch late = new CountDownLatch(1);
                    lock.acquireRead();
                    Thread lateWriter = probe(lock::acquireWrite, lock::releaseWrite, late);
                    if (late.await(100, TimeUnit.MILLISECONDS)) fail(round, "a writer got in while a read lock was held");
                    lock.releaseRead();
                    lateWriter.join();
                    out.append("held\n");
                }
                case "share" -> {
                    // Every reader must be able to hold the read lock at once.
                    int n = Integer.parseInt(in[at++]);
                    CyclicBarrier together = new CyclicBarrier(n);
                    run(Collections.nCopies(n, own -> {
                        pause(own);
                        lock.acquireRead();
                        try {
                            together.await(2, TimeUnit.SECONDS);
                        } catch (TimeoutException | BrokenBarrierException e) {
                            fail(round, n + " readers could not hold the read lock at the same time");
                        }
                        lock.releaseRead();
                    }));
                    out.append(n).append('\n');
                }
                default -> {
                    int readers = Integer.parseInt(in[at++]), writers = Integer.parseInt(in[at++]);
                    int ops = Integer.parseInt(in[at++]);
                    long[] data = new long[2]; // a writer adds its value to both; a reader must never see them differ
                    int[] inside = new int[2]; // readers and writers past acquire
                    List<Work> workers = new ArrayList<>(Collections.nCopies(readers, own -> {
                        for (int n = 0; n < ops; n++) {
                            pause(own);
                            lock.acquireRead();
                            synchronized (inside) {
                                if (inside[1] > 0) fail(round, "a reader got in while a writer held the lock");
                                inside[0]++;
                            }
                            long a = data[0];
                            pause(own);
                            long b = data[1];
                            if (a != b) fail(round, "a reader saw a half-done write (" + a + " and " + b + ")");
                            synchronized (inside) {
                                inside[0]--;
                            }
                            lock.releaseRead();
                        }
                    }));
                    for (int i = 0; i < writers; i++) {
                        long v = Long.parseLong(in[at++]);
                        workers.add(own -> {
                            for (int n = 0; n < ops; n++) {
                                pause(own);
                                lock.acquireWrite();
                                synchronized (inside) {
                                    if (inside[0] > 0 || inside[1] > 0)
                                        fail(round, "a writer got in while another thread held the lock");
                                    inside[1]++;
                                }
                                long a = data[0];
                                pause(own);
                                data[0] = a + v;
                                pause(own);
                                data[1] += v;
                                synchronized (inside) {
                                    inside[1]--;
                                }
                                lock.releaseWrite();
                            }
                        });
                    }
                    run(workers);
                    out.append(data[0]).append('\n');
                }
            }
        }
        System.out.print(out);
    }
}
