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

    private Entry[] table = new Entry[8];
    private int size = 0;

    // Multiplicative hashing spreads keys that share low bits; the unsigned remainder is never negative.
    private static int index(int key, int buckets) {
        return Integer.remainderUnsigned(key * 0x9E3779B1, buckets);
    }

    void put(int key, int value) {
        int i = index(key, table.length);
        for (Entry e = table[i]; e != null; e = e.next)
            if (e.key == key) {
                e.value = value;
                return;
            }
        table[i] = new Entry(key, value, table[i]);
        if (++size * 4 > table.length * 3) {
            Entry[] next = new Entry[2 * table.length];
            for (Entry chain : table)
                for (Entry e = chain; e != null; e = e.next) {
                    int j = index(e.key, next.length);
                    next[j] = new Entry(e.key, e.value, next[j]);
                }
            table = next;
        }
    }

    int get(int key) {
        for (Entry e = table[index(key, table.length)]; e != null; e = e.next)
            if (e.key == key) return e.value;
        return -1;
    }

    boolean remove(int key) {
        int i = index(key, table.length);
        Entry prev = null;
        for (Entry e = table[i]; e != null; prev = e, e = e.next)
            if (e.key == key) {
                if (prev == null) table[i] = e.next;
                else prev.next = e.next;
                size--;
                return true;
            }
        return false;
    }

    int size() {
        return size;
    }

    int buckets() {
        return table.length;
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
