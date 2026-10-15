import java.io.*;
import java.util.*;

class Node {
    int key, value;
    Node prev, next;

    Node(int key, int value) {
        this.key = key;
        this.value = value;
    }
}

// LRU 缓存 / LRU cache: a hash map to the nodes of a doubly linked list, most recent first.
class LRUCache {
    private final int capacity;
    private final Map<Integer, Node> nodes = new HashMap<>();
    // TODO: 双向链表（建议用两个哨兵节点） / the doubly linked list (two sentinels help)

    LRUCache(int capacity) {
        this.capacity = capacity;
    }

    int get(int key) {
        return -1; // TODO
    }

    int put(int key, int value) {
        return -1; // TODO: 返回被淘汰的键或 -1 / the evicted key, or -1
    }

    List<Integer> keys() {
        return new ArrayList<>(); // TODO: 从最近到最久 / most recent first
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
        LRUCache cache = new LRUCache(nextInt());
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "get" -> out.append(cache.get(nextInt())).append('\n');
                case "put" -> {
                    int k = nextInt();
                    out.append(cache.put(k, nextInt())).append('\n');
                }
                default -> {
                    List<Integer> keys = cache.keys();
                    if (keys.isEmpty()) out.append("empty");
                    for (int i = 0; i < keys.size(); i++) out.append(i > 0 ? " " : "").append(keys.get(i));
                    out.append('\n');
                }
            }
        }
        System.out.print(out);
    }
}
