import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;
import java.util.function.*;

// 零、偶、奇 / Zero, even, odd: together emit 0 1 0 2 0 3 ... 0 n, one thread per method.
class ZeroEvenOdd {
    private final int n;
    private final Semaphore zeroTurn = new Semaphore(1);
    private final Semaphore evenTurn = new Semaphore(0);
    private final Semaphore oddTurn = new Semaphore(0);

    ZeroEvenOdd(int n) {
        this.n = n;
    }

    void zero(IntConsumer emit) throws InterruptedException {
        for (int i = 1; i <= n; i++) {
            zeroTurn.acquire();
            emit.accept(0);
            (i % 2 == 1 ? oddTurn : evenTurn).release();
        }
    }

    void even(IntConsumer emit) throws InterruptedException {
        for (int i = 2; i <= n; i += 2) {
            evenTurn.acquire();
            emit.accept(i);
            zeroTurn.release();
        }
    }

    void odd(IntConsumer emit) throws InterruptedException {
        for (int i = 1; i <= n; i += 2) {
            oddTurn.acquire();
            emit.accept(i);
            zeroTurn.release();
        }
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
            ZeroEvenOdd trio = new ZeroEvenOdd(Integer.parseInt(in[2 + r]));
            List<Integer> log = Collections.synchronizedList(new ArrayList<>());
            List<Thread> threads = new ArrayList<>();
            for (int k = 0; k < 3; k++) {
                int method = k;
                Random own = new Random(rng.nextLong());
                threads.add(new Thread(() -> {
                    IntConsumer emit = x -> {
                        pause(own);
                        log.add(x);
                        pause(own);
                    };
                    pause(own);
                    try {
                        if (method == 0) trio.zero(emit);
                        else if (method == 1) trio.even(emit);
                        else trio.odd(emit);
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }));
            }
            Collections.shuffle(threads, rng);
            for (Thread t : threads) t.start();
            for (Thread t : threads) t.join();
            for (int i = 0; i < log.size(); i++) out.append(i > 0 ? " " : "").append(log.get(i));
            out.append('\n');
        }
        System.out.print(out);
    }
}
