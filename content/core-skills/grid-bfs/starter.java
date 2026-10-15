import java.io.*;
import java.util.*;

class GridBfs {
    // 网格 BFS / Fewest 4-directional steps from S to T, or -1.
    static int shortestPath(String[] grid) {
        return -1; // TODO
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
        String[] grid = new String[Integer.parseInt(next())];
        next();
        for (int r = 0; r < grid.length; r++) grid[r] = next();
        System.out.println(GridBfs.shortestPath(grid));
    }
}
