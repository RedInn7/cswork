import java.io.*;
import java.util.*;

// 哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75.
class HashMap {
    private static class Entry {
        final int key;
        int value;
        Entry next;

        Entry(int key, int value, Entry next) {
            this.key = key;
            this.value = value;
            this.next = next;
        }
    }

    private Entry[] table = new Entry[8]; // 每个桶是一条 Entry 链表 / each bucket is a chain of entries
    private int size = 0;

    void put(int key, int value) {
        // TODO
    }

    int get(int key) {
        return -1; // TODO
    }

    boolean remove(int key) {
        return false; // TODO
    }

    int size() {
        return 0; // TODO
    }

    int buckets() {
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
        HashMap table = new HashMap();
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "put" -> {
                    int k = nextInt();
                    table.put(k, nextInt());
                }
                case "get" -> out.append(table.get(nextInt())).append('\n');
                case "remove" -> out.append(table.remove(nextInt()) ? 1 : 0).append('\n');
                case "size" -> out.append(table.size()).append('\n');
                default -> out.append(table.buckets()).append('\n');
            }
        }
        System.out.print(out);
    }
}
