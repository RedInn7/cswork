import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

// 交替输出 / Take turns: foo and bar each call emit n times, foo first, strictly alternating.
class FooBar {
    private final int n;
    // TODO: 需要的同步工具 / the synchronization you need

    FooBar(int n) {
        this.n = n;
    }

    void foo(Runnable emit) throws InterruptedException {
        // TODO: 调用 n 次 emit.run()，每次都轮到 foo 时才调用 / call emit.run() n times, each on foo's turn
    }

    void bar(Runnable emit) throws InterruptedException {
        // TODO: 调用 n 次 emit.run()，每次都轮到 bar 时才调用 / call emit.run() n times, each on bar's turn
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
            FooBar pair = new FooBar(Integer.parseInt(in[2 + 3 * r]));
            List<String> log = Collections.synchronizedList(new ArrayList<>());
            List<Thread> threads = new ArrayList<>();
            for (int k = 0; k < 2; k++) {
                int side = k;
                String word = in[3 + 3 * r + k];
                Random own = new Random(rng.nextLong());
                threads.add(new Thread(() -> {
                    Runnable emit = () -> {
                        pause(own);
                        log.add(word);
                        pause(own);
                    };
                    pause(own);
                    try {
                        if (side == 0) pair.foo(emit);
                        else pair.bar(emit);
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
