import java.io.*;
import java.util.*;

// 电梯 / Elevator: one car.
// 建议用两个 TreeSet / Suggested: two TreeSet<Integer>, upStops（上行时停 / stop while going up）
// and downStops（下行时停 / stop while going down）. 方向 / directions: "UP", "DOWN", "IDLE".
class Elevator {
    Elevator(int floors, int start) {
        // TODO
    }

    String call(int f, String want) {
        return ""; // TODO: 厅外按钮 / a hall call ("UP" / "DOWN"): "OK"
    }

    String press(int f) {
        return ""; // TODO: 轿厢内按钮 / a car button: "OK", or "OPEN" at this floor
    }

    String step() {
        return ""; // TODO: "<floor> <dir> OPEN" or "<floor> <dir> -"
    }

    String where() {
        return ""; // TODO: "<floor> <dir> <pending stops>"
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
