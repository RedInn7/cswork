import java.io.*;
import java.util.*;

// 线段树 / Segment tree of range sums with point updates.
class SegmentTree {
    // TODO

    SegmentTree(long[] values) {
        // TODO
    }

    void update(int i, long x) {
        // TODO
    }

    long query(int l, int r) {
        return 0; // TODO
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
