import java.io.*;
import java.util.*;

class ShortestPaths {
    // Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable.
    static long[] dijkstra(int n, int[][] edges, int s) {
        List<List<int[]>> adj = new ArrayList<>();
        for (int v = 0; v <= n; v++) adj.add(new ArrayList<>());
        for (int[] e : edges) adj.get(e[0]).add(new int[] {e[1], e[2]});
        long[] dist = new long[n + 1];
        Arrays.fill(dist, -1);
        dist[s] = 0;
        PriorityQueue<long[]> heap = new PriorityQueue<>((a, b) -> Long.compare(a[0], b[0]));
        heap.add(new long[] {0, s});
        while (!heap.isEmpty()) {
            long[] top = heap.poll();
            long d = top[0];
            int u = (int) top[1];
            if (d > dist[u]) continue; // stale
            for (int[] e : adj.get(u))
                if (dist[e[0]] < 0 || d + e[1] < dist[e[0]]) {
                    dist[e[0]] = d + e[1];
                    heap.add(new long[] {dist[e[0]], e[0]});
                }
        }
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
        long[] dist = ShortestPaths.dijkstra(n, edges, s);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) out.append(dist[i]).append(i + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
