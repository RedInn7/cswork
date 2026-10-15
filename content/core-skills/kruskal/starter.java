import java.io.*;
import java.util.*;

class Mst {
    // Kruskal / Indices of the chosen edges in the order chosen; fewer than n - 1 if disconnected.
    static List<Integer> kruskal(int n, int[][] edges) {
        return new ArrayList<>(); // TODO: 排序 + 并查集 / sort + union-find
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
