import java.io.*;
import java.util.*;

// 最小堆 / Binary min-heap on an array: parent (i - 1) / 2, children 2i + 1 and 2i + 2.
class MinHeap {
    private int[] a = new int[16];
    private int n = 0;

    void push(int x) {
        // TODO: 放到末尾后上浮 / append, then sift up
    }

    int pop() {
        return 0; // TODO: 末尾移到堆顶后下沉 / move the last to the top, then sift down
    }

    int top() {
        return 0; // TODO
    }

    int size() {
        return 0; // TODO
    }

    void build(int[] values) {
        // TODO: Floyd 建堆 / Floyd's construction
    }

    int[] dump() {
        return new int[0]; // TODO
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
