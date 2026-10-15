import java.io.*;
import java.util.*;

class Node {
    int val;
    Node next;

    Node(int val, Node next) {
        this.val = val;
        this.next = next;
    }
}

// 单链表 / Singly linked list with head and tail pointers.
class LinkedList {
    private Node head, tail;
    private int length;

    void pushFront(int x) {
        // TODO
    }

    void pushBack(int x) {
        // TODO
    }

    int popFront() {
        return 0; // TODO
    }

    void insert(int i, int x) {
        // TODO
    }

    boolean remove(int x) {
        return false; // TODO
    }

    void reverse() {
        // TODO
    }

    int size() {
        return 0; // TODO
    }

    int[] values() {
        return new int[0]; // TODO: 从 head 走到尾 / walk from head to the end
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
        LinkedList lst = new LinkedList();
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "push_front" -> lst.pushFront(nextInt());
                case "push_back" -> lst.pushBack(nextInt());
                case "pop_front" -> out.append(lst.popFront()).append('\n');
                case "insert" -> {
                    int i = nextInt();
                    lst.insert(i, nextInt());
                }
                case "remove" -> out.append(lst.remove(nextInt()) ? 1 : 0).append('\n');
                case "reverse" -> lst.reverse();
                case "size" -> out.append(lst.size()).append('\n');
                default -> {
                    int[] v = lst.values();
                    if (v.length == 0) out.append("empty");
                    for (int k = 0; k < v.length; k++) out.append(k > 0 ? " " : "").append(v[k]);
                    out.append('\n');
                }
            }
        }
        System.out.print(out);
    }
}
