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
    private final Node head = new Node(0, 0), tail = new Node(0, 0); // sentinels

    LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    private void unlink(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void pushFront(Node node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    int get(int key) {
        Node node = nodes.get(key);
        if (node == null) return -1;
        unlink(node);
        pushFront(node);
        return node.value;
    }

    int put(int key, int value) {
        Node node = nodes.get(key);
        if (node != null) {
            node.value = value;
            unlink(node);
            pushFront(node);
            return -1;
        }
        node = new Node(key, value);
        nodes.put(key, node);
        pushFront(node);
        if (nodes.size() <= capacity) return -1;
        Node oldest = tail.prev;
        unlink(oldest);
        nodes.remove(oldest.key);
        return oldest.key;
    }

    List<Integer> keys() {
        List<Integer> out = new ArrayList<>();
        for (Node node = head.next; node != tail; node = node.next) out.add(node.key);
        return out;
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
