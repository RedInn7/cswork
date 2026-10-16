import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

// 有界阻塞队列 / Bounded blocking queue: FIFO, at most capacity items; put waits when full, take when empty.
// Build it yourself: no ArrayBlockingQueue, LinkedBlockingQueue or other BlockingQueue.
class BoundedBlockingQueue {
    private final int[] items; // a ring buffer
    private int head, size;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    BoundedBlockingQueue(int capacity) {
        items = new int[capacity];
    }

    void put(int x) throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (size == items.length) notFull.await();
            items[(head + size) % items.length] = x;
            size++;
            notEmpty.signal();
        } finally {
            lock.unlock();
        }
    }

    int take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (size == 0) notEmpty.await();
            int x = items[head];
            head = (head + 1) % items.length;
            size--;
            notFull.signal();
            return x;
        } finally {
            lock.unlock();
        }
    }
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
public class Main {
    static final StringBuilder out = new StringBuilder();

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

    public static void main(String[] args) throws Exception {
        String[] in = new String(System.in.readAllBytes()).trim().split("\\s+");
        Random rng = new Random(Long.parseLong(in[0]));
        for (int r = 1, rounds = Integer.parseInt(in[1]); r <= rounds; r++) {
            int round = r;
            int capacity = Integer.parseInt(in[4 * r - 2]), producers = Integer.parseInt(in[4 * r - 1]);
            int consumers = Integer.parseInt(in[4 * r]), k = Integer.parseInt(in[4 * r + 1]), total = producers * k;
            BoundedBlockingQueue queue = new BoundedBlockingQueue(capacity);
            boolean[] started = new boolean[total + 1], taken = new boolean[total + 1];
            long[] count = new long[4]; // puts returned, takes begun, takes returned, sum taken
            List<Thread> threads = new ArrayList<>();
            for (int i = 0; i < producers; i++) {
                int from = i * k + 1;
                Random own = new Random(rng.nextLong());
                threads.add(new Thread(() -> {
                    try {
                        for (int x = from; x < from + k; x++) {
                            pause(own);
                            synchronized (count) {
                                started[x] = true;
                            }
                            queue.put(x);
                            synchronized (count) {
                                // At least puts - takes items are inside the queue right now.
                                if (++count[0] - count[1] > capacity)
                                    fail(round, "the queue went over its capacity of " + capacity);
                            }
                        }
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }));
            }
            for (int j = 0; j < consumers; j++) {
                int share = total / consumers + (j < total % consumers ? 1 : 0);
                Random own = new Random(rng.nextLong());
                threads.add(new Thread(() -> {
                    int[] last = new int[producers]; // the last item this consumer took from each producer
                    try {
                        if (own.nextDouble() < 0.5) Thread.sleep(1); // let the producers run ahead
                        for (int n = 0; n < share; n++) {
                            pause(own);
                            synchronized (count) {
                                count[1]++;
                            }
                            int x = queue.take();
                            synchronized (count) {
                                if (x < 1 || x > total || !started[x])
                                    fail(round, "take() returned " + x + ", which was never put");
                                if (taken[x]) fail(round, x + " was taken twice");
                                int p = (x - 1) / k;
                                if (x < last[p]) fail(round, x + " came out after " + last[p] + ", though it was put first");
                                taken[x] = true;
                                last[p] = x;
                                count[2]++;
                                count[3] += x;
                            }
                        }
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }));
            }
            Collections.shuffle(threads, rng);
            for (Thread t : threads) t.start();
            for (Thread t : threads) t.join();
            if (count[2] != total) fail(round, "only " + count[2] + " of " + total + " items came out");
            out.append(total).append(' ').append(count[3]).append('\n');
        }
        System.out.print(out);
    }
}
