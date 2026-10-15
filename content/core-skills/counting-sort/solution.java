import java.io.*;
import java.util.*;

class CountingSort {
    // 稳定计数排序 / Stable counting sort: record indices ordered by key, ties in input order.
    static int[] countingSort(int[] keys, int k) {
        int[] start = new int[k + 1];
        for (int key : keys) start[key + 1]++;
        for (int v = 0; v < k; v++) start[v + 1] += start[v];
        int[] order = new int[keys.length];
        for (int i = 0; i < keys.length; i++) order[start[keys[i]]++] = i;
        return order;
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
        int n = nextInt(), k = nextInt();
        int[] keys = new int[n];
        for (int i = 0; i < n; i++) keys[i] = nextInt();
        int[] order = CountingSort.countingSort(keys, k);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) out.append(order[i] + 1).append(i + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
