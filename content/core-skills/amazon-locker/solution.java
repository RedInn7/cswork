import java.io.*;
import java.util.*;

// 取件码生成器 / Pickup codes from a fixed LCG, so the judge can replay them (production: a CSPRNG).
class CodeGenerator {
    private long x;

    CodeGenerator(long seed) {
        x = seed;
    }

    String next() {
        x = (x * 1103515245L + 12345) % 2147483648L;
        return String.format("%06d", x % 1000000);
    }
}

record Parcel(String pkg, int compartment, long deadline) {}

// 快递柜 / Locker station: free compartments by size, parcels by code, expiry and a keypad lockout.
class LockerStation {
    static final int MAX_FAILURES = 5, LOCKOUT = 30;
    private final long keep;
    private final CodeGenerator codes;
    private final List<PriorityQueue<Integer>> freeBySize = new ArrayList<>();
    private final List<Integer> sizeOf = new ArrayList<>(); // compartment - 1 -> size
    private final Map<String, Parcel> byCode = new HashMap<>(); // 有效的取件码 -> 包裹 / active code -> parcel
    private final ArrayDeque<Map.Entry<String, Parcel>> queue = new ArrayDeque<>(); // 按投递顺序 / delivery order
    private final List<String> returned = new ArrayList<>(); // 超期待退回 / expired, waiting for the returns courier
    private int failures = 0;
    private long lockedUntil = -1;

    LockerStation(int[] counts, long keep, long seed) {
        this.keep = keep;
        codes = new CodeGenerator(seed);
        int id = 1;
        for (int size = 0; size < 3; size++) {
            PriorityQueue<Integer> pool = new PriorityQueue<>();
            for (int k = 0; k < counts[size]; k++, id++) {
                pool.add(id);
                sizeOf.add(size);
            }
            freeBySize.add(pool);
        }
    }

    private void expire(long t) {
        while (!queue.isEmpty() && queue.peekFirst().getValue().deadline() <= t) {
            Map.Entry<String, Parcel> entry = queue.pollFirst();
            if (byCode.get(entry.getKey()) == entry.getValue()) { // 还没被取走 / not picked up yet
                byCode.remove(entry.getKey());
                release(entry.getValue().compartment());
                returned.add(entry.getValue().pkg());
            }
        }
    }

    private void release(int compartment) {
        freeBySize.get(sizeOf.get(compartment - 1)).add(compartment);
    }

    String deliver(long t, String pkg, int size) {
        expire(t);
        Integer compartment = null;
        for (int s = size; s < 3 && compartment == null; s++) compartment = freeBySize.get(s).poll(); // 最小能装下的 / smallest fit
        if (compartment == null) return "FULL";
        String code = codes.next();
        while (byCode.containsKey(code)) code = codes.next(); // 和有效的码重复就重抽 / never reuse an active code
        Parcel parcel = new Parcel(pkg, compartment, t + keep);
        byCode.put(code, parcel);
        queue.addLast(Map.entry(code, parcel));
        return compartment + " " + code;
    }

    String pickup(long t, String code) {
        expire(t);
        if (t < lockedUntil) return "LOCKED";
        Parcel parcel = byCode.remove(code);
        if (parcel == null) {
            if (++failures == MAX_FAILURES) { // 连续输错：锁键盘 / too many wrong codes: lock the keypad
                failures = 0;
                lockedUntil = t + LOCKOUT;
            }
            return "INVALID";
        }
        failures = 0;
        release(parcel.compartment());
        return parcel.pkg() + " " + parcel.compartment();
    }

    String returns(long t) {
        expire(t);
        String out = returned.isEmpty() ? "NONE" : String.join(" ", returned);
        returned.clear();
        return out;
    }

    int free(long t, int size) {
        expire(t);
        return freeBySize.get(size).size();
    }
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
public class Main {
    private static byte[] in;
    private static int pos;

    private static String next() {
        while (in[pos] <= ' ') pos++;
        int start = pos;
        while (pos < in.length && in[pos] > ' ') pos++;
        return new String(in, start, pos - start);
    }

    private static int size(String s) {
        return s.equals("S") ? 0 : s.equals("M") ? 1 : 2;
    }

    public static void main(String[] args) throws IOException {
        in = System.in.readAllBytes();
        int[] counts = new int[3];
        for (int i = 0; i < 3; i++) counts[i] = Integer.parseInt(next());
        long keep = Long.parseLong(next());
        LockerStation station = new LockerStation(counts, keep, Long.parseLong(next()));
        StringBuilder out = new StringBuilder();
        for (int q = Integer.parseInt(next()); q > 0; q--) {
            String op = next();
            long t = Long.parseLong(next());
            switch (op) {
                case "deliver" -> {
                    String pkg = next();
                    out.append(station.deliver(t, pkg, size(next())));
                }
                case "pickup" -> out.append(station.pickup(t, next()));
                case "returns" -> out.append(station.returns(t));
                default -> out.append(station.free(t, size(next())));
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
