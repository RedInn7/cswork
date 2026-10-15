import java.io.*;
import java.util.*;

// 双端队列 / Deque on a ring buffer: element i lives at data[(head + i) % capacity].
class RingDeque {
    private int[] data = new int[4];
    private int head = 0, size = 0;

    private void grow() {
        int[] next = new int[2 * data.length];
        for (int i = 0; i < size; i++) next[i] = data[(head + i) % data.length];
        data = next;
        head = 0;
    }

    void pushFront(int x) {
        if (size == data.length) grow();
        head = (head - 1 + data.length) % data.length;
        data[head] = x;
        size++;
    }

    void pushBack(int x) {
        if (size == data.length) grow();
        data[(head + size) % data.length] = x;
        size++;
    }

    int popFront() {
        int x = data[head];
        head = (head + 1) % data.length;
        size--;
        return x;
    }

    int popBack() {
        int x = back();
        size--;
        return x;
    }

    int front() {
        return data[head];
    }

    int back() {
        return get(size - 1);
    }

    int get(int i) {
        return data[(head + i) % data.length];
    }

    int size() {
        return size;
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
        RingDeque dq = new RingDeque();
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            String op = next();
            if (op.equals("push_front")) dq.pushFront(nextInt());
            else if (op.equals("push_back")) dq.pushBack(nextInt());
            else if (op.equals("get")) out.append(dq.get(nextInt())).append('\n');
            else if (op.equals("size")) out.append(dq.size()).append('\n');
            else if (dq.size() == 0) out.append("empty\n");
            else if (op.equals("pop_front")) out.append(dq.popFront()).append('\n');
            else if (op.equals("pop_back")) out.append(dq.popBack()).append('\n');
            else if (op.equals("front")) out.append(dq.front()).append('\n');
            else out.append(dq.back()).append('\n');
        }
        System.out.print(out);
    }
}
