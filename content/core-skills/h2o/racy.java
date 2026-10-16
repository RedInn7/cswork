import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

// No synchronization: every atom bonds as soon as it arrives.
class H2O {
    void hydrogen(Runnable bond) throws InterruptedException {
        bond.run();
    }

    void oxygen(Runnable bond) throws InterruptedException {
        bond.run();
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
            String atoms = in[1 + r];
            H2O water = new H2O();
            StringBuilder log = new StringBuilder();
            List<Thread> threads = new ArrayList<>();
            for (char atom : atoms.toCharArray()) {
                Random own = new Random(rng.nextLong());
                threads.add(new Thread(() -> {
                    Runnable bond = () -> {
                        pause(own);
                        synchronized (log) {
                            String group = log.substring(log.length() - log.length() % 3);
                            int molecule = log.length() / 3 + 1;
                            if (atom == 'H' && group.chars().filter(c -> c == 'H').count() == 2)
                                fail(round, "molecule " + molecule + " got a third hydrogen");
                            if (atom == 'O' && group.indexOf('O') >= 0)
                                fail(round, "molecule " + molecule + " got a second oxygen");
                            log.append(atom);
                        }
                        pause(own);
                    };
                    pause(own);
                    try {
                        if (atom == 'H') water.hydrogen(bond);
                        else water.oxygen(bond);
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }));
            }
            for (Thread t : threads) t.start();
            for (Thread t : threads) t.join();
            if (log.length() != atoms.length()) fail(round, log.length() + " of " + atoms.length() + " atoms bonded");
            out.append(atoms.length() / 3).append('\n');
        }
        System.out.print(out);
    }
}
