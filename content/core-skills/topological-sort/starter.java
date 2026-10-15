import java.io.*;
import java.util.*;

class Topo {
    // Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or an empty list on a cycle.
    static List<Integer> topoOrder(int n, int[][] edges) {
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
        int n = nextInt(), m = nextInt();
        int[][] edges = new int[m][];
        for (int i = 0; i < m; i++) edges[i] = new int[] {nextInt(), nextInt()};
        List<Integer> order = Topo.topoOrder(n, edges);
        StringBuilder out = new StringBuilder();
        if (order.isEmpty()) out.append(-1);
        for (int i = 0; i < order.size(); i++) out.append(i > 0 ? " " : "").append(order.get(i));
        System.out.println(out);
    }
}
