import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;
import java.util.function.*;

// 哲学家就餐 / Dining philosophers: n at a round table, fork p between philosopher p and p + 1.
class DiningTable {
    private final int n;
    // TODO: 需要的同步工具 / the synchronization you need

    DiningTable(int n) {
        this.n = n;
    }

    void dine(int p, IntConsumer pick, Runnable eat, IntConsumer drop) throws InterruptedException {
        // TODO: 拿起叉子 p 和 (p + 1) % n，吃一次，再放下这两把叉子
        //       pick up forks p and (p + 1) % n, eat once, then put both down
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
        int at = 2;
        for (int r = 1, rounds = Integer.parseInt(in[1]); r <= rounds; r++) {
            int round = r, n = Integer.parseInt(in[at++]);
            int[] wanted = new int[n], holder = new int[n], meals = new int[n];
            for (int p = 0; p < n; p++) wanted[p] = Integer.parseInt(in[at++]);
            Arrays.fill(holder, -1);
            DiningTable table = new DiningTable(n);
            Object guard = new Object();
            List<Thread> threads = new ArrayList<>();
            for (int k = 0; k < n; k++) {
                int p = k, left = p, right = (p + 1) % n;
                Random own = new Random(rng.nextLong());
                IntConsumer pick = f -> {
                    pause(own);
                    synchronized (guard) {
                        if (f != left && f != right)
                            fail(round, "philosopher " + p + " picked up fork " + f + ", which is not next to them");
                        if (holder[f] != -1)
                            fail(round, "philosopher " + p + " picked up fork " + f + " while philosopher " + holder[f] + " held it");
                        holder[f] = p;
                    }
                    pause(own);
                };
                Runnable eat = () -> {
                    synchronized (guard) {
                        if (holder[left] != p || holder[right] != p)
                            fail(round, "philosopher " + p + " ate without holding forks " + left + " and " + right);
                        meals[p]++;
                    }
                    pause(own);
                };
                IntConsumer drop = f -> {
                    pause(own);
                    synchronized (guard) {
                        if (holder[f] != p) fail(round, "philosopher " + p + " put down fork " + f + " without holding it");
                        holder[f] = -1;
                    }
                };
                threads.add(new Thread(() -> {
                    for (int i = 0; i < wanted[p]; i++) {
                        pause(own);
                        int before;
                        synchronized (guard) {
                            before = meals[p];
                        }
                        try {
                            table.dine(p, pick, eat, drop);
                        } catch (InterruptedException e) {
                            throw new RuntimeException(e);
                        }
                        synchronized (guard) {
                            if (meals[p] != before + 1)
                                fail(round, "philosopher " + p + " ate " + (meals[p] - before) + " times in one dine call");
                            if (holder[left] == p || holder[right] == p)
                                fail(round, "philosopher " + p + " left the table holding a fork");
                        }
                    }
                }));
            }
            Collections.shuffle(threads, rng);
            for (Thread t : threads) t.start();
            for (Thread t : threads) t.join();
            for (int p = 0; p < n; p++) out.append(p > 0 ? " " : "").append(meals[p]);
            out.append('\n');
        }
        System.out.print(out);
    }
}
