import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

// 按序执行 / Run in order: three threads call first, second and third once each, in any order.
class InOrder {
    private final CountDownLatch firstDone = new CountDownLatch(1);
    private final CountDownLatch secondDone = new CountDownLatch(1);

    void first(Runnable job) throws InterruptedException {
        job.run();
        firstDone.countDown();
    }

    void second(Runnable job) throws InterruptedException {
        firstDone.await();
        job.run();
        secondDone.countDown();
    }

    void third(Runnable job) throws InterruptedException {
        secondDone.await();
        job.run();
    }
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
public class Main {
    static void pause(Random rng) {
        double r = rng.nextDouble();
        if (r < 0.4) Thread.yield();
        else if (r < 0.45) LockSupport.parkNanos(50_000);
    }

    public static void main(String[] args) throws Exception {
        String[] in = new String(System.in.readAllBytes()).trim().split("\\s+");
        Random rng = new Random(Long.parseLong(in[0]));
        StringBuilder out = new StringBuilder();
        for (int r = 0, rounds = Integer.parseInt(in[1]); r < rounds; r++) {
            InOrder order = new InOrder();
            List<String> log = Collections.synchronizedList(new ArrayList<>());
            List<Thread> threads = new ArrayList<>();
            for (int k = 0; k < 3; k++) {
                int step = k;
                String word = in[2 + 3 * r + k];
                Random own = new Random(rng.nextLong());
                threads.add(new Thread(() -> {
                    Runnable job = () -> {
                        pause(own);
                        log.add(word);
                        pause(own);
                    };
                    pause(own);
                    try {
                        if (step == 0) order.first(job);
                        else if (step == 1) order.second(job);
                        else order.third(job);
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }));
            }
            Collections.shuffle(threads, rng);
            for (Thread t : threads) t.start();
            for (Thread t : threads) t.join();
            out.append(String.join(" ", log)).append('\n');
        }
        System.out.print(out);
    }
}
