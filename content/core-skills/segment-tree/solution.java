import java.io.*;
import java.util.*;

// 线段树 / Iterative segment tree of sums: leaves at n..2n-1, node k's parent at k / 2.
class SegmentTree {
    private final int n;
    private final long[] tree;

    SegmentTree(long[] values) {
        n = values.length;
        tree = new long[2 * n];
        System.arraycopy(values, 0, tree, n, n);
        for (int k = n - 1; k > 0; k--) tree[k] = tree[2 * k] + tree[2 * k + 1];
    }

    void update(int i, long x) {
        int k = i + n;
        tree[k] = x;
        for (k /= 2; k >= 1; k /= 2) tree[k] = tree[2 * k] + tree[2 * k + 1];
    }

    long query(int l, int r) {
        long total = 0;
        for (l += n, r += n + 1; l < r; l /= 2, r /= 2) {
            if ((l & 1) == 1) total += tree[l++];
            if ((r & 1) == 1) total += tree[--r];
        }
        return total;
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
        SegmentTree tree = new SegmentTree(values);
        StringBuilder out = new StringBuilder();
        while (q-- > 0) {
            String op = next();
            int a = nextInt(), b = nextInt();
            if (op.equals("set")) tree.update(a - 1, b);
            else out.append(tree.query(a - 1, b - 1)).append('\n');
        }
        System.out.print(out);
    }
}
