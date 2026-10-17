import java.io.*;
import java.util.*;

// 快递柜 / Locker station.
// 建议拆出 / Suggested: CodeGenerator（题面里的 LCG / the statement's LCG）, Parcel（包裹、格口、截止时刻 /
// package, compartment, deadline）; 每种尺寸一个空格口堆 / a free-compartment heap per size;
// 取件码 -> 包裹的哈希表 / a hash map from code to parcel. 尺寸 size: 0 = S, 1 = M, 2 = L.
class LockerStation {
    LockerStation(int[] counts, long keep, long seed) {
        // TODO
    }

    String deliver(long t, String pkg, int size) {
        return ""; // TODO: "<compartment> <code>" or "FULL"
    }

    String pickup(long t, String code) {
        return ""; // TODO: "<pkg> <compartment>", "INVALID", "LOCKED"
    }

    String returns(long t) {
        return ""; // TODO: 待退回的包裹 / packages to return, or "NONE"
    }

    int free(long t, int size) {
        return 0; // TODO: 该尺寸的空格口数 / free compartments of exactly that size
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
