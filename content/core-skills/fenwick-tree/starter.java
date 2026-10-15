import java.io.*;
import java.util.*;

// 树状数组 / Fenwick tree over indices 1..n: tree[i] sums (i - lowbit(i), i].
class FenwickTree {
    private final int n;
    private final long[] tree;

    FenwickTree(long[] values) {
        n = values.length;
        tree = new long[n + 1];
        // TODO: 建树 / build
    }

    void add(int i, long x) {
        // TODO
    }

    long prefix(int i) {
        return 0; // TODO
    }

    int kth(long k) {
        return -1; // TODO: 倍增 / binary lifting
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
        int n = nextInt(), q = nextInt();
        long[] values = new long[n];
        for (int i = 0; i < n; i++) values[i] = nextInt();
        FenwickTree tree = new FenwickTree(values);
        StringBuilder out = new StringBuilder();
        while (q-- > 0) {
            switch (next()) {
                case "add" -> {
                    int i = nextInt();
                    tree.add(i, nextInt());
                }
                case "prefix" -> out.append(tree.prefix(nextInt())).append('\n');
                default -> out.append(tree.kth(nextInt())).append('\n');
            }
        }
        System.out.print(out);
    }
}
