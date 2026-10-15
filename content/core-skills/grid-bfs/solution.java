import java.io.*;
import java.util.*;

class GridBfs {
    // 网格 BFS / Fewest 4-directional steps from S to T, or -1.
    static int shortestPath(String[] grid) {
        int rows = grid.length, cols = grid[0].length();
        int[] dist = new int[rows * cols];
        Arrays.fill(dist, -1);
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (grid[r].charAt(c) == 'S') {
                    dist[r * cols + c] = 0;
                    queue.add(r * cols + c);
                }
        int[] dr = {1, -1, 0, 0}, dc = {0, 0, 1, -1};
        while (!queue.isEmpty()) {
            int cell = queue.poll(), r = cell / cols, c = cell % cols;
            if (grid[r].charAt(c) == 'T') return dist[cell];
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                if (grid[nr].charAt(nc) == '#' || dist[nr * cols + nc] >= 0) continue;
                dist[nr * cols + nc] = dist[cell] + 1;
                queue.add(nr * cols + nc);
            }
        }
        return -1;
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
