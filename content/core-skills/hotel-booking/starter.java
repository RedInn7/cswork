import java.io.*;
import java.util.*;

// 酒店预订 / Hotel booking.
// 建议拆出 / Suggested: RoomType（间数、价格、每晚已订出几间 / count, rates, rooms taken per night）,
// Reservation（预订：房型、入住、退房、是否有效 / type, check-in, check-out, active）,
// PricingRule（价格规则 / the pricing rule）. 第 0 天是周一 / day 0 is a Monday.
class Hotel {
    Hotel(Map<String, long[]> specs) {
        // TODO: specs.get(name) = {count, base, weekend}
    }

    String book(String kind, int checkIn, int checkOut) {
        return ""; // TODO: "<id> <price>", "FULL", "INVALID"
    }

    String cancel(int day, long id) {
        return ""; // TODO: "OK", "TOO_LATE", "INVALID"
    }

    int free(String kind, int night) {
        return 0; // TODO: 这一晚该房型的空房数 / free rooms of that type that night
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

    private static int nextInt() {
        return Integer.parseInt(next());
    }

    public static void main(String[] args) throws IOException {
        in = System.in.readAllBytes();
        Map<String, long[]> specs = new HashMap<>();
        for (int t = nextInt(); t > 0; t--) {
            String name = next();
            specs.put(name, new long[] {nextInt(), nextInt(), nextInt()});
        }
        Hotel hotel = new Hotel(specs);
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "book" -> {
                    String kind = next();
                    int checkIn = nextInt();
                    out.append(hotel.book(kind, checkIn, nextInt()));
                }
                case "cancel" -> {
                    int day = nextInt();
                    out.append(hotel.cancel(day, Long.parseLong(next())));
                }
                default -> {
                    String kind = next();
                    out.append(hotel.free(kind, nextInt()));
                }
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
