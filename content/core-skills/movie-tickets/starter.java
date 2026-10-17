import java.io.*;
import java.util.*;

// 一场电影的座位 / One show's seats.
// 建议拆出 / Suggested: Hold（锁座：用户、座位、过期时刻、状态 / user, seats, expiry, status）;
// 每个座位记住占着它的锁座 / each seat remembers the hold that has it; 到期的锁座在每个操作开始时释放
// / release expired holds at the start of every operation.
class Show {
    Show(int seats, long ttl) {
        // TODO: 座位编号 1..seats / seats 1..seats; holds expire ttl after they are made
    }

    String hold(long t, String user, int[] seats) {
        return ""; // TODO: id, "TOO_MANY", "UNAVAILABLE <seat>"
    }

    String confirm(long t, long id, String user) {
        return ""; // TODO: "OK", "EXPIRED", "INVALID"
    }

    String release(long t, long id, String user) {
        return ""; // TODO: "OK", "EXPIRED", "INVALID"
    }

    int free(long t) {
        return 0; // TODO: 空座数 / free seats
    }

    String seat(long t, int s) {
        return ""; // TODO: "FREE", "HELD <user>", "BOOKED <user>"
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
