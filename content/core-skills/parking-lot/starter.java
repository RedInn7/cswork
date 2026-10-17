import java.io.*;
import java.util.*;

// 停车场 / Parking lot.
// 建议拆出 / Suggested classes: SpotAllocator（每种尺寸一个空位堆 / a free-spot heap per size）,
// Ticket, HourlyPricing（计费策略 / the pricing strategy）. 尺寸 size: 0 = S, 1 = M, 2 = L.
class ParkingLot {
    // counts[size]: 该尺寸车位数 / spots of that size; rates[size]: 每小时价格 / price per hour
    ParkingLot(int[] counts, int[] rates) {
        // TODO
    }

    String park(String plate, int size, long t) {
        return ""; // TODO: "<ticket> <spot>", "FULL", "DUPLICATE"
    }

    String unpark(long ticketId, long t) {
        return ""; // TODO: 停车费 / the fee, or "INVALID"
    }

    int available(int size) {
        return 0; // TODO: 该尺寸的空位数 / free spots of exactly that size
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
