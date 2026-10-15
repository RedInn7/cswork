import java.io.*;
import java.util.*;

// 树状数组 / Fenwick tree over indices 1..n: tree[i] sums (i - lowbit(i), i].
class FenwickTree {
    private final int n;
    private final long[] tree;

    FenwickTree(long[] values) {
        n = values.length;
        tree = new long[n + 1];
        System.arraycopy(values, 0, tree, 1, n);
        for (int i = 1; i <= n; i++) { // O(n) build
            int j = i + (i & -i);
            if (j <= n) tree[j] += tree[i];
        }
    }

    void add(int i, long x) {
        for (; i <= n; i += i & -i) tree[i] += x;
    }

    long prefix(int i) {
        long total = 0;
        for (; i > 0; i -= i & -i) total += tree[i];
        return total;
    }

    int kth(long k) {
        if (prefix(n) < k) return -1;
        int pos = 0;
        for (int step = Integer.highestOneBit(n); step > 0; step >>= 1)
            if (pos + step <= n && tree[pos + step] < k) {
                pos += step;
                k -= tree[pos];
            }
        return pos + 1;
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
