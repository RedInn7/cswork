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
        head = new Node(x, head);
        if (tail == null) tail = head;
        length++;
    }

    void pushBack(int x) {
        Node node = new Node(x, null);
        if (tail == null) head = node;
        else tail.next = node;
        tail = node;
        length++;
    }

    int popFront() {
        Node node = head;
        head = node.next;
        if (head == null) tail = null;
        length--;
        return node.val;
    }

    void insert(int i, int x) {
        if (i == 0) {
            pushFront(x);
            return;
        }
        if (i == length) {
            pushBack(x);
            return;
        }
        Node prev = head;
        for (int k = 0; k < i - 1; k++) prev = prev.next;
        prev.next = new Node(x, prev.next);
        length++;
    }

    boolean remove(int x) {
        Node prev = null, node = head;
        while (node != null && node.val != x) {
            prev = node;
            node = node.next;
        }
        if (node == null) return false;
        if (prev == null) head = node.next;
        else prev.next = node.next;
        if (node == tail) tail = prev;
        length--;
        return true;
    }

    void reverse() {
        Node prev = null, node = head;
        tail = head;
        while (node != null) {
            Node next = node.next;
            node.next = prev;
            prev = node;
            node = next;
        }
        head = prev;
    }

    int size() {
        return length;
    }

    int[] values() {
        int[] out = new int[length];
        int k = 0;
        for (Node node = head; node != null; node = node.next) out[k++] = node.val;
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
