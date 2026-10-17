import java.io.*;
import java.util.*;

enum Status { ACTIVE, BOOKED, RELEASED, EXPIRED }

class Hold {
    final String user;
    final int[] seats;
    final long expires;
    Status status = Status.ACTIVE;

    Hold(String user, int[] seats, long expires) {
        this.user = user;
        this.seats = seats;
        this.expires = expires;
    }
}

// 一场电影的座位 / One show's seats: each seat points at the hold that has it, or 0 when free.
class Show {
    static final int MAX_SEATS = 10;
    private final long ttl;
    private final int[] owner; // seat -> hold id, 0: free
    private final List<Hold> holds = new ArrayList<>(); // hold id - 1 -> hold
    private final ArrayDeque<Hold> queue = new ArrayDeque<>(); // 按过期时间排好 / in expiry order (one TTL for all)
    private int freeCount;

    Show(int seats, long ttl) {
        this.ttl = ttl;
        owner = new int[seats + 1];
        freeCount = seats;
    }

    // 到期的锁座自动释放 / Release every active hold whose time is up (expires <= t).
    private void expire(long t) {
        while (!queue.isEmpty() && queue.peekFirst().expires <= t) {
            Hold hold = queue.pollFirst();
            if (hold.status == Status.ACTIVE) {
                hold.status = Status.EXPIRED;
                freeSeats(hold);
            }
        }
    }

    private void freeSeats(Hold hold) {
        for (int s : hold.seats) owner[s] = 0;
        freeCount += hold.seats.length;
    }

    String hold(long t, String user, int[] seats) {
        expire(t);
        if (seats.length > MAX_SEATS) return "TOO_MANY";
        for (int s : seats) // 全有或全无 / all or nothing
            if (owner[s] != 0) return "UNAVAILABLE " + s;
        Hold hold = new Hold(user, seats, t + ttl);
        holds.add(hold);
        queue.addLast(hold);
        for (int s : seats) owner[s] = holds.size();
        freeCount -= seats.length;
        return String.valueOf(holds.size());
    }

    private String finish(long t, long id, String user, Status to) {
        expire(t);
        if (id < 1 || id > holds.size() || !holds.get((int) id - 1).user.equals(user)) return "INVALID";
        Hold hold = holds.get((int) id - 1);
        if (hold.status == Status.EXPIRED) return "EXPIRED";
        if (hold.status != Status.ACTIVE) return "INVALID";
        hold.status = to;
        if (to == Status.RELEASED) freeSeats(hold);
        return "OK";
    }

    String confirm(long t, long id, String user) {
        return finish(t, id, user, Status.BOOKED);
    }

    String release(long t, long id, String user) {
        return finish(t, id, user, Status.RELEASED);
    }

    int free(long t) {
        expire(t);
        return freeCount;
    }

    String seat(long t, int s) {
        expire(t);
        if (owner[s] == 0) return "FREE";
        Hold hold = holds.get(owner[s] - 1);
        return (hold.status == Status.BOOKED ? "BOOKED " : "HELD ") + hold.user;
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
        int seats = nextInt();
        Show show = new Show(seats, Long.parseLong(next()));
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            String op = next();
            long t = Long.parseLong(next());
            switch (op) {
                case "hold" -> {
                    String user = next();
                    int[] chosen = new int[nextInt()];
                    for (int i = 0; i < chosen.length; i++) chosen[i] = nextInt();
                    out.append(show.hold(t, user, chosen));
                }
                case "confirm", "release" -> {
                    long id = Long.parseLong(next());
                    String user = next();
                    out.append(op.equals("confirm") ? show.confirm(t, id, user) : show.release(t, id, user));
                }
                case "free" -> out.append(show.free(t));
                default -> out.append(show.seat(t, nextInt()));
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
