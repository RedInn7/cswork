import java.io.*;
import java.util.*;

class ShortestPaths {
    // Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable.
    static long[] dijkstra(int n, int[][] edges, int s) {
        long[] dist = new long[n];
        Arrays.fill(dist, -1); // TODO
        return dist;
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
        int n = nextInt(), m = nextInt(), s = nextInt();
        int[][] edges = new int[m][];
        for (int i = 0; i < m; i++) edges[i] = new int[] {nextInt(), nextInt(), nextInt()};
        long[] dist = ShortestPaths.dijkstra(n, edges, s);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) out.append(dist[i]).append(i + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
