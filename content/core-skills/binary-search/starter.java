import java.io.*;
import java.util.*;

class Search {
    // 第一个 >= x 的下标 / First index with a[i] >= x, or a.length.
    static int lowerBound(int[] a, int x) {
        return 0; // TODO
    }

    // 第一个 > x 的下标 / First index with a[i] > x, or a.length.
    static int upperBound(int[] a, int x) {
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
        int n = nextInt(), q = nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = nextInt();
        StringBuilder out = new StringBuilder();
        while (q-- > 0) {
            int x = nextInt();
            out.append(Search.lowerBound(a, x)).append(' ').append(Search.upperBound(a, x)).append('\n');
        }
        System.out.print(out);
    }
}
