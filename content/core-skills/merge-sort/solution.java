import java.io.*;
import java.util.*;

class MergeSort {
    private static long sort(int[] a, int[] buf, int lo, int hi) { // [lo, hi)
        if (hi - lo < 2) return 0;
        int mid = (lo + hi) / 2;
        long count = sort(a, buf, lo, mid) + sort(a, buf, mid, hi);
        int i = lo, j = mid;
        for (int k = lo; k < hi; k++) {
            if (j >= hi || (i < mid && a[i] <= a[j])) buf[k] = a[i++];
            else {
                buf[k] = a[j++];
                count += mid - i;
            }
        }
        System.arraycopy(buf, lo, a, lo, hi - lo);
        return count;
    }

    // 归并排序 / Sort a in place and return its inversion count.
    static long mergeSort(int[] a) {
        return sort(a, new int[a.length], 0, a.length);
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
