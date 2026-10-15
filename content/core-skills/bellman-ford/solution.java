import java.io.*;
import java.util.*;

class BellmanFord {
    static final long INF = Long.MAX_VALUE; // 到不了 / unreachable

    // Bellman-Ford / Distances from s to nodes 1..n (INF if unreachable), or null if s reaches a negative cycle.
    static long[] bellmanFord(int n, int[][] edges, int s) {
        long[] dist = new long[n + 1];
        Arrays.fill(dist, INF);
        dist[s] = 0;
        for (int round = 1; round < n; round++) {
            boolean changed = false;
            for (int[] e : edges)
                if (dist[e[0]] != INF && dist[e[0]] + e[2] < dist[e[1]]) {
                    dist[e[1]] = dist[e[0]] + e[2];
                    changed = true;
                }
            if (!changed) break;
        }
        for (int[] e : edges)
            if (dist[e[0]] != INF && dist[e[0]] + e[2] < dist[e[1]]) return null;
        return Arrays.copyOfRange(dist, 1, n + 1);
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
        long[] dist = BellmanFord.bellmanFord(n, edges, s);
        if (dist == null) {
            System.out.println("NEGATIVE CYCLE");
            return;
        }
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++)
            out.append(dist[i] == BellmanFord.INF ? "INF" : String.valueOf(dist[i])).append(i + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
