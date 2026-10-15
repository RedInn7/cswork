import java.io.*;
import java.util.*;

// 字典树 / Trie of lowercase words, counting repeated inserts.
class Trie {
    private static class Node {
        final Node[] children = new Node[26];
        int pass, end; // 经过 / 结束于该节点的单词数 / words through / ending at this node
    }

    private final Node root = new Node();

    void insert(String word) {
        // TODO
    }

    boolean erase(String word) {
        return false; // TODO
    }

    boolean search(String word) {
        return false; // TODO
    }

    int countPrefix(String p) {
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

    public static void main(String[] args) throws IOException {
        in = System.in.readAllBytes();
        Trie trie = new Trie();
        StringBuilder out = new StringBuilder();
        for (int q = Integer.parseInt(next()); q > 0; q--) {
            String op = next(), word = next();
            switch (op) {
                case "insert" -> trie.insert(word);
                case "erase" -> out.append(trie.erase(word) ? 1 : 0).append('\n');
                case "search" -> out.append(trie.search(word) ? 1 : 0).append('\n');
                default -> out.append(trie.countPrefix(word)).append('\n');
            }
        }
        System.out.print(out);
    }
}
