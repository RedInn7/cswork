import java.io.*;
import java.util.*;

class DenseMst {
    // O(n²) Prim / Nodes (0-based) in the order they join the tree from node 0; fewer than n if disconnected.
    static List<Integer> prim(int n, int[][] w) {
        return new ArrayList<>(); // TODO
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
        int n = nextInt();
        int[][] w = new int[n][n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++) w[i][j] = nextInt();
        List<Integer> order = DenseMst.prim(n, w);
        if (order.size() != n) {
            System.out.println(-1);
            return;
        }
        // Each node joined through its lightest edge to the nodes before it.
        long total = 0;
        for (int k = 1; k < n; k++) {
            int best = Integer.MAX_VALUE;
            for (int j = 0; j < k; j++) {
                int e = w[order.get(j)][order.get(k)];
                if (e > 0 && e < best) best = e;
            }
            total += best;
        }
        StringBuilder out = new StringBuilder().append(total).append('\n');
        for (int k = 0; k < n; k++) out.append(order.get(k) + 1).append(k + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
