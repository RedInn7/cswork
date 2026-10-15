import java.io.*;
import java.util.*;

// 动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter.
class DynamicArray {
    private int[] data = new int[1];
    private int size = 0;

    private void resize(int capacity) {
        int[] next = new int[capacity];
        for (int i = 0; i < size; i++) next[i] = data[i];
        data = next;
    }

    void push(int x) {
        insert(size, x);
    }

    int pop() {
        return erase(size - 1);
    }

    int get(int i) {
        return data[i];
    }

    void set(int i, int x) {
        data[i] = x;
    }

    void insert(int i, int x) {
        if (size == data.length) resize(2 * data.length);
        for (int j = size; j > i; j--) data[j] = data[j - 1];
        data[i] = x;
        size++;
    }

    int erase(int i) {
        int x = data[i];
        for (int j = i; j + 1 < size; j++) data[j] = data[j + 1];
        size--;
        if (data.length > 1 && size * 4 <= data.length) resize(data.length / 2);
        return x;
    }

    int size() {
        return size;
    }

    int capacity() {
        return data.length;
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
