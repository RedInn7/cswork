import java.io.*;
import java.util.*;

// 并查集 / Union-find over nodes 1..n with path halving and union by rank.
class UnionFind {
    private final int[] parent;
    // TODO: 秩、集合大小、集合个数 / ranks, set sizes, number of sets

    UnionFind(int n) {
        parent = new int[n + 1];
        for (int v = 0; v <= n; v++) parent[v] = v;
    }

    int find(int x) {
        return x; // TODO
    }

    boolean union(int a, int b) {
        return false; // TODO
    }

    boolean same(int a, int b) {
        return false; // TODO
    }

    int size(int x) {
        return 1; // TODO
    }

    int count() {
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
        UnionFind uf = new UnionFind(nextInt());
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "union" -> {
                    int a = nextInt();
                    out.append(uf.union(a, nextInt()) ? 1 : 0).append('\n');
                }
                case "same" -> {
                    int a = nextInt();
                    out.append(uf.same(a, nextInt()) ? 1 : 0).append('\n');
                }
                case "size" -> out.append(uf.size(nextInt())).append('\n');
                default -> out.append(uf.count()).append('\n');
            }
        }
        System.out.print(out);
    }
}
