import java.io.*;
import java.util.*;

class RoomType {
    static final int DAYS = 100000;
    final int count;
    final long base, weekend;
    final int[] booked = new int[DAYS]; // 每晚已订出的间数 / rooms taken per night

    RoomType(int count, long base, long weekend) {
        this.count = count;
        this.base = base;
        this.weekend = weekend;
    }
}

// 价格规则（策略） / A pricing rule (strategy).
interface PricingRule {
    long rate(RoomType room, int night);
}

// 周五、周六晚用周末价 / Friday and Saturday nights at the weekend rate (day 0 is a Monday).
class WeekendPricing implements PricingRule {
    public long rate(RoomType room, int night) {
        return night % 7 == 4 || night % 7 == 5 ? room.weekend : room.base;
    }
}

class Reservation {
    final RoomType room;
    final int checkIn, checkOut;
    boolean active = true;

    Reservation(RoomType room, int checkIn, int checkOut) {
        this.room = room;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
    }
}

// 酒店预订 / Hotel booking: inventory counted per room type and night.
class Hotel {
    static final int MAX_NIGHTS = 30;
    private final Map<String, RoomType> types = new HashMap<>();
    private final PricingRule pricing = new WeekendPricing();
    private final List<Reservation> reservations = new ArrayList<>(); // id - 1 -> reservation

    Hotel(Map<String, long[]> specs) {
        specs.forEach((name, spec) -> types.put(name, new RoomType((int) spec[0], spec[1], spec[2])));
    }

    String book(String kind, int checkIn, int checkOut) {
        if (checkOut - checkIn <= 0 || checkOut - checkIn > MAX_NIGHTS) return "INVALID";
        RoomType room = types.get(kind);
        for (int d = checkIn; d < checkOut; d++) // 每一晚都要有空房 / every night must have a room
            if (room.booked[d] >= room.count) return "FULL";
        long price = 0;
        for (int d = checkIn; d < checkOut; d++) {
            room.booked[d]++;
            price += pricing.rate(room, d);
        }
        reservations.add(new Reservation(room, checkIn, checkOut));
        return reservations.size() + " " + price;
    }

    String cancel(int day, long id) {
        if (id < 1 || id > reservations.size() || !reservations.get((int) id - 1).active) return "INVALID";
        Reservation r = reservations.get((int) id - 1);
        if (day >= r.checkIn) return "TOO_LATE";
        r.active = false;
        for (int d = r.checkIn; d < r.checkOut; d++) r.room.booked[d]--;
        return "OK";
    }

    int free(String kind, int night) {
        RoomType room = types.get(kind);
        return room.count - room.booked[night];
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
