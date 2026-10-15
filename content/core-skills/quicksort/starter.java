import java.io.*;
import java.util.*;

class QuickSort {
    // Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index.
    static int partition(int[] a, int lo, int hi) {
        return lo; // TODO
    }

    // 原地升序排序 / Sort a in place.
    static void quickSort(int[] a) {
        // TODO
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
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = nextInt();
        int[] b = a.clone();
        int p = QuickSort.partition(b, 0, n - 1);
        QuickSort.quickSort(a);
        StringBuilder out = new StringBuilder().append(p).append('\n');
        for (int i = 0; i < n; i++) out.append(b[i]).append(i + 1 < n ? ' ' : '\n');
        for (int i = 0; i < n; i++) out.append(a[i]).append(i + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
