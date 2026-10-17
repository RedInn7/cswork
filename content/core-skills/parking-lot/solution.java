import java.io.*;
import java.util.*;

// 每种尺寸一个空位小根堆 / one min-heap of free spot ids per size.
class SpotAllocator {
    private final List<PriorityQueue<Integer>> free = new ArrayList<>();
    final List<Integer> sizeOf = new ArrayList<>(); // spot id - 1 -> size

    SpotAllocator(int[] counts) {
        int id = 1;
        for (int size = 0; size < 3; size++) {
            PriorityQueue<Integer> pool = new PriorityQueue<>();
            for (int k = 0; k < counts[size]; k++, id++) {
                pool.add(id);
                sizeOf.add(size);
            }
            free.add(pool);
        }
    }

    int allocate(int need) { // 先试刚好合适的尺寸 / smallest size that fits first; -1: none
        for (int size = need; size < 3; size++)
            if (!free.get(size).isEmpty()) return free.get(size).poll();
        return -1;
    }

    void release(int spot) {
        free.get(sizeOf.get(spot - 1)).add(spot);
    }

    int freeCount(int size) {
        return free.get(size).size();
    }
}

record Ticket(String plate, int spot, long entry) {}

class HourlyPricing {
    private final int[] rates;

    HourlyPricing(int[] rates) {
        this.rates = rates;
    }

    long fee(int size, long minutes) {
        return Math.max(1, (minutes + 59) / 60) * rates[size];
    }
}

// 停车场 / Parking lot: tickets by id, plates parked, a spot allocator and a pricing rule.
class ParkingLot {
    private final SpotAllocator allocator;
    private final HourlyPricing pricing;
    private final Map<Long, Ticket> active = new HashMap<>(); // ticket id -> ticket
    private final Set<String> parked = new HashSet<>();
    private long nextId = 1;

    ParkingLot(int[] counts, int[] rates) {
        allocator = new SpotAllocator(counts);
        pricing = new HourlyPricing(rates);
    }

    String park(String plate, int size, long t) {
        if (parked.contains(plate)) return "DUPLICATE";
        int spot = allocator.allocate(size);
        if (spot < 0) return "FULL";
        long id = nextId++;
        active.put(id, new Ticket(plate, spot, t));
        parked.add(plate);
        return id + " " + spot;
    }

    String unpark(long ticketId, long t) {
        Ticket ticket = active.remove(ticketId); // 取出即作废 / used once
        if (ticket == null) return "INVALID";
        parked.remove(ticket.plate());
        allocator.release(ticket.spot());
        return String.valueOf(pricing.fee(allocator.sizeOf.get(ticket.spot() - 1), t - ticket.entry()));
    }

    int available(int size) {
        return allocator.freeCount(size);
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
        int[] counts = new int[3], rates = new int[3];
        for (int i = 0; i < 3; i++) counts[i] = Integer.parseInt(next());
        for (int i = 0; i < 3; i++) rates[i] = Integer.parseInt(next());
        ParkingLot lot = new ParkingLot(counts, rates);
        StringBuilder out = new StringBuilder();
        for (int q = Integer.parseInt(next()); q > 0; q--) {
            switch (next()) {
                case "park" -> {
                    String plate = next();
                    int size = size(next());
                    out.append(lot.park(plate, size, Long.parseLong(next()))).append('\n');
                }
                case "unpark" -> {
                    long ticket = Long.parseLong(next());
                    out.append(lot.unpark(ticket, Long.parseLong(next()))).append('\n');
                }
                default -> out.append(lot.available(size(next()))).append('\n');
            }
        }
        System.out.print(out);
    }
}
