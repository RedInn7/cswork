import java.io.*;
import java.util.*;

// 最小堆 / Binary min-heap on an array: parent (i - 1) / 2, children 2i + 1 and 2i + 2.
class MinHeap {
    private int[] a = new int[16];
    private int n = 0;

    private void swap(int i, int j) {
        int t = a[i];
        a[i] = a[j];
        a[j] = t;
    }

    private void siftUp(int i) {
        while (i > 0 && a[i] < a[(i - 1) / 2]) {
            swap(i, (i - 1) / 2);
            i = (i - 1) / 2;
        }
    }

    private void siftDown(int i) {
        while (2 * i + 1 < n) {
            int c = 2 * i + 1;
            if (c + 1 < n && a[c + 1] < a[c]) c++;
            if (!(a[c] < a[i])) break;
            swap(i, c);
            i = c;
        }
    }

    void push(int x) {
        if (n == a.length) a = Arrays.copyOf(a, 2 * n);
        a[n++] = x;
        siftUp(n - 1);
    }

    int pop() {
        int top = a[0];
        a[0] = a[--n];
        if (n > 0) siftDown(0);
        return top;
    }

    int top() {
        return a[0];
    }

    int size() {
        return n;
    }

    void build(int[] values) {
        a = Arrays.copyOf(values, Math.max(16, values.length));
        n = values.length;
        for (int i = n / 2 - 1; i >= 0; i--) siftDown(i);
    }

    int[] dump() {
        return Arrays.copyOf(a, n);
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
        MinHeap heap = new MinHeap();
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            String op = next();
            if (op.equals("push")) heap.push(nextInt());
            else if (op.equals("build")) {
                int[] values = new int[nextInt()];
                for (int k = 0; k < values.length; k++) values[k] = nextInt();
                heap.build(values);
            } else if (op.equals("size")) out.append(heap.size()).append('\n');
            else if (op.equals("dump")) {
                int[] v = heap.dump();
                if (v.length == 0) out.append("empty");
                for (int k = 0; k < v.length; k++) out.append(k > 0 ? " " : "").append(v[k]);
                out.append('\n');
            } else if (heap.size() == 0) out.append("empty\n");
            else if (op.equals("pop")) out.append(heap.pop()).append('\n');
            else out.append(heap.top()).append('\n');
        }
        System.out.print(out);
    }
}
