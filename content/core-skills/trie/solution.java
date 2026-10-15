import java.io.*;
import java.util.*;

// 字典树 / Trie of lowercase words, counting repeated inserts.
class Trie {
    private static class Node {
        final Node[] children = new Node[26];
        int pass, end; // 经过 / 结束于该节点的单词数 / words through / ending at this node
    }

    private final Node root = new Node();

    private Node walk(String word) {
        Node node = root;
        for (int i = 0; i < word.length() && node != null; i++) node = node.children[word.charAt(i) - 'a'];
        return node;
    }

    void insert(String word) {
        Node node = root;
        node.pass++;
        for (int i = 0; i < word.length(); i++) {
            int c = word.charAt(i) - 'a';
            if (node.children[c] == null) node.children[c] = new Node();
            node = node.children[c];
            node.pass++;
        }
        node.end++;
    }

    boolean erase(String word) {
        if (!search(word)) return false;
        Node node = root;
        node.pass--;
        for (int i = 0; i < word.length(); i++) {
            node = node.children[word.charAt(i) - 'a'];
            node.pass--;
        }
        node.end--;
        return true;
    }

    boolean search(String word) {
        Node node = walk(word);
        return node != null && node.end > 0;
    }

    int countPrefix(String p) {
        Node node = walk(p);
        return node == null ? 0 : node.pass;
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
