import java.io.*;
import java.util.*;

// 电梯 / Elevator: one car, LOOK scheduling over two sets of stops.
class Elevator {
    private int floor;
    private String dir = "IDLE";
    private final TreeSet<Integer> upStops = new TreeSet<>(); // 上行时要停的楼层 / floors to stop at going up
    private final TreeSet<Integer> downStops = new TreeSet<>(); // 下行时要停的楼层 / floors to stop at going down

    Elevator(int floors, int start) {
        floor = start;
    }

    String call(int f, String want) {
        (want.equals("UP") ? upStops : downStops).add(f);
        return "OK";
    }

    String press(int f) {
        if (f > floor) upStops.add(f);
        else if (f < floor) downStops.add(f);
        else return "OPEN";
        return "OK";
    }

    private boolean workAbove() {
        return upStops.higher(floor) != null || downStops.higher(floor) != null;
    }

    private boolean workBelow() {
        return upStops.lower(floor) != null || downStops.lower(floor) != null;
    }

    String step() {
        if (dir.equals("UP") && !workAbove()) dir = workBelow() ? "DOWN" : "IDLE";
        else if (dir.equals("DOWN") && !workBelow()) dir = workAbove() ? "UP" : "IDLE";
        else if (dir.equals("IDLE")) dir = workAbove() ? "UP" : workBelow() ? "DOWN" : "IDLE";
        boolean stop;
        if (dir.equals("IDLE")) { // 别处没有任务：服务本层 / nothing elsewhere: serve this floor
            stop = upStops.remove(floor) | downStops.remove(floor);
        } else if ((dir.equals("UP") ? upStops : downStops).remove(floor)) {
            stop = true; // 本层有同方向的请求：开门，这一步不动 / a call here this way: open, stay
        } else if (dir.equals("UP")) {
            floor++;
            stop = upStops.remove(floor);
            if (!workAbove()) stop |= downStops.remove(floor); // 本趟的最高点 / top of the sweep
        } else {
            floor--;
            stop = downStops.remove(floor);
            if (!workBelow()) stop |= upStops.remove(floor);
        }
        return floor + " " + dir + (stop ? " OPEN" : " -");
    }

    String where() {
        return floor + " " + dir + " " + (upStops.size() + downStops.size());
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
        int floors = nextInt();
        Elevator car = new Elevator(floors, nextInt());
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "call" -> {
                    int f = nextInt();
                    out.append(car.call(f, next().equals("U") ? "UP" : "DOWN"));
                }
                case "press" -> out.append(car.press(nextInt()));
                case "step" -> out.append(car.step());
                default -> out.append(car.where());
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
