import java.io.*;
import java.util.*;

class MergeSort {
    // 归并排序 / Sort a in place and return its inversion count.
    static long mergeSort(int[] a) {
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
        int n = nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = nextInt();
        StringBuilder out = new StringBuilder().append(MergeSort.mergeSort(a)).append('\n');
        for (int i = 0; i < n; i++) out.append(a[i]).append(i + 1 < n ? ' ' : '\n');
        System.out.print(out);
    }
}
