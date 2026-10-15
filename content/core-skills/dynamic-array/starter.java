import java.io.*;
import java.util.*;

// 动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter.
class DynamicArray {
    // TODO: 定长存储 new int[capacity] 加一个长度 / fixed-size storage plus a length

    void push(int x) {
        // TODO
    }

    int pop() {
        return 0; // TODO
    }

    int get(int i) {
        return 0; // TODO
    }

    void set(int i, int x) {
        // TODO
    }

    void insert(int i, int x) {
        // TODO
    }

    int erase(int i) {
        return 0; // TODO
    }

    int size() {
        return 0; // TODO
    }

    int capacity() {
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
        DynamicArray arr = new DynamicArray();
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "push" -> arr.push(nextInt());
                case "pop" -> out.append(arr.pop()).append('\n');
                case "get" -> out.append(arr.get(nextInt())).append('\n');
                case "set" -> {
                    int i = nextInt();
                    arr.set(i, nextInt());
                }
                case "insert" -> {
                    int i = nextInt();
                    arr.insert(i, nextInt());
                }
                case "erase" -> out.append(arr.erase(nextInt())).append('\n');
                case "size" -> out.append(arr.size()).append('\n');
                default -> out.append(arr.capacity()).append('\n');
            }
        }
        System.out.print(out);
    }
}
