import java.io.*;
import java.util.*;

class Mst {
    private static int[] parent, rank;

    private static int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]]; // path halving
        return x;
    }

    // Kruskal / Indices of the chosen edges in the order chosen; fewer than n - 1 if disconnected.
    static List<Integer> kruskal(int n, int[][] edges) {
        parent = new int[n + 1];
        rank = new int[n + 1];
        for (int v = 0; v <= n; v++) parent[v] = v;
        Integer[] order = new Integer[edges.length];
        for (int i = 0; i < order.length; i++) order[i] = i;
        Arrays.sort(order, (i, j) -> Integer.compare(edges[i][2], edges[j][2])); // stable for objects
        List<Integer> chosen = new ArrayList<>();
        for (int i : order) {
            int a = find(edges[i][0]), b = find(edges[i][1]);
            if (a == b) continue;
            if (rank[a] < rank[b]) {
                int t = a;
                a = b;
                b = t;
            }
            parent[b] = a;
            if (rank[a] == rank[b]) rank[a]++;
            chosen.add(i);
            if (chosen.size() == n - 1) break;
        }
        return chosen;
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
        for (int i = 0; i < m; i++) edges[i] = new int[] {nextInt(), nextInt(), nextInt()};
        List<Integer> chosen = Mst.kruskal(n, edges);
        if (chosen.size() != n - 1) {
            System.out.println(-1);
            return;
        }
        long total = 0;
        StringBuilder ids = new StringBuilder();
        for (int k = 0; k < chosen.size(); k++) {
            total += edges[chosen.get(k)][2];
            ids.append(k > 0 ? " " : "").append(chosen.get(k) + 1);
        }
        System.out.println(total + "\n" + ids);
    }
}
