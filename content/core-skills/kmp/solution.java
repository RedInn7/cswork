import java.io.*;
import java.util.*;

class Kmp {
    // 前缀函数 / pi[i]: longest proper prefix of p[0..i] that is also its suffix.
    static int[] prefixFunction(String p) {
        int[] pi = new int[p.length()];
        for (int i = 1; i < p.length(); i++) {
            int j = pi[i - 1];
            while (j > 0 && p.charAt(i) != p.charAt(j)) j = pi[j - 1];
            if (p.charAt(i) == p.charAt(j)) j++;
            pi[i] = j;
        }
        return pi;
    }

    // KMP 匹配 / Every start index of p in t, overlaps included, in O(|t| + |p|).
    static List<Integer> findAll(String t, String p) {
        int[] pi = prefixFunction(p);
        List<Integer> out = new ArrayList<>();
        int j = 0;
        for (int i = 0; i < t.length(); i++) {
            while (j > 0 && t.charAt(i) != p.charAt(j)) j = pi[j - 1];
            if (t.charAt(i) == p.charAt(j)) j++;
            if (j == p.length()) {
                out.add(i - j + 1);
                j = pi[j - 1];
            }
        }
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

    public static void main(String[] args) throws IOException {
        in = System.in.readAllBytes();
        String t = next(), p = next();
        int[] pi = Kmp.prefixFunction(p);
        List<Integer> found = Kmp.findAll(t, p);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < pi.length; i++) out.append(pi[i]).append(i + 1 < pi.length ? ' ' : '\n');
        out.append(found.size()).append('\n');
        if (found.isEmpty()) out.append(-1);
        for (int i = 0; i < found.size(); i++) out.append(i > 0 ? " " : "").append(found.get(i));
        System.out.println(out);
    }
}
