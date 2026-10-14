import type { Language } from './problems';

/**
 * Stdin/stdout skeletons for ACM-mode problems, written for CSWork. Each one is
 * a whole program that solves a toy task, so tests can run it on `sample`.
 */
export type AcmIoTemplate = {
  id: string;
  title: { zh: string; en: string };
  note: { zh: string; en: string };
  sample: { input: string; output: string };
  code: Record<Language, string>;
};

// Raw source: backslashes stay as written; drops the newline after the backtick.
const src = (s: TemplateStringsArray) => s.raw[0].slice(1);

export const ACM_IO_TEMPLATES: AcmIoTemplate[] = [
  {
    id: 'single',
    title: { zh: '单组输入', en: 'Single test case' },
    note: {
      zh: '只有一组数据，读完直接输出。按「空白分隔的记号」读（split / cin >> / Fscan），换行和多余空格都不影响。示例：输出 a + b。',
      en: 'One test case: read it, print the answer. Reading whitespace-separated tokens (split / cin >> / Fscan) ignores line breaks and extra spaces. Example: print a + b.',
    },
    sample: { input: '3 5\n', output: '8\n' },
    code: {
      python: src`
import sys

def main():
    data = sys.stdin.read().split()
    a, b = int(data[0]), int(data[1])
    print(a + b)

main()
`,
      cpp: src`
#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    long long a, b;
    cin >> a >> b;
    cout << a + b << '\n';
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        long a = Long.parseLong(st.nextToken());
        long b = Long.parseLong(st.nextToken());
        System.out.println(a + b);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    var a, b int64
    fmt.Fscan(in, &a, &b)
    fmt.Println(a + b)
}
`,
    },
  },
  {
    id: 'eof',
    title: { zh: '多组输入，读到文件结束（EOF）', en: 'Read until end of input (EOF)' },
    note: {
      zh: '题目不告诉组数时，一直读到输入结束。C++ 用 while (cin >> a >> b)，Java 判断 readLine() 返回 null，Go 判断 Fscan 的 err，Python 直接 for line in sys.stdin。',
      en: "When the number of cases isn't given, read until input runs out: while (cin >> a >> b) in C++, readLine() == null in Java, Fscan's err in Go, and for line in sys.stdin in Python.",
    },
    sample: { input: '1 2\n3 4\n10 20\n', output: '3\n7\n30\n' },
    code: {
      python: src`
import sys

def main():
    out = []
    for line in sys.stdin:
        parts = line.split()
        if not parts:
            continue
        a, b = int(parts[0]), int(parts[1])
        out.append(str(a + b))
    print('\n'.join(out))

main()
`,
      cpp: src`
#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    long long a, b;
    while (cin >> a >> b) {
        cout << a + b << '\n';
    }
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            StringTokenizer st = new StringTokenizer(line);
            if (!st.hasMoreTokens()) continue;
            long a = Long.parseLong(st.nextToken());
            long b = Long.parseLong(st.nextToken());
            out.append(a + b).append('\n');
        }
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    var a, b int64
    for {
        if _, err := fmt.Fscan(in, &a, &b); err != nil {
            break
        }
        fmt.Fprintln(out, a+b)
    }
}
`,
    },
  },
  {
    id: 't-cases',
    title: { zh: '首行给出组数 T', en: 'T test cases on the first line' },
    note: {
      zh: '第一行是组数 T，后面每组格式相同。循环 T 次，每组答案单独一行；输出先攒起来最后一次打印，比每组 print 快。',
      en: 'Line 1 holds T, the number of cases; each case has the same format. Loop T times and print one answer per line. Collecting output and printing once is faster than printing per case.',
    },
    sample: { input: '3\n1 2\n3 4\n5 6\n', output: '3\n7\n11\n' },
    code: {
      python: src`
import sys

def main():
    input = sys.stdin.readline
    t = int(input())
    out = []
    for _ in range(t):
        a, b = map(int, input().split())
        out.append(str(a + b))
    print('\n'.join(out))

main()
`,
      cpp: src`
#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    cin >> t;
    while (t--) {
        long long a, b;
        cin >> a >> b;
        cout << a + b << '\n';
    }
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int t = Integer.parseInt(br.readLine().trim());
        StringBuilder out = new StringBuilder();
        while (t-- > 0) {
            StringTokenizer st = new StringTokenizer(br.readLine());
            long a = Long.parseLong(st.nextToken());
            long b = Long.parseLong(st.nextToken());
            out.append(a + b).append('\n');
        }
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    var t int
    fmt.Fscan(in, &t)
    for ; t > 0; t-- {
        var a, b int64
        fmt.Fscan(in, &a, &b)
        fmt.Fprintln(out, a+b)
    }
}
`,
    },
  },
  {
    id: 'sentinel',
    title: { zh: '多组输入，以 0 0 结束', en: 'Stop at a terminator (0 0)' },
    note: {
      zh: '读到约定的结束标记（如 0 0）就停，标记本身不处理、不输出。先判断标记再计算。',
      en: 'Stop at the agreed terminator, such as 0 0. The terminator itself is neither processed nor printed, so check it before computing.',
    },
    sample: { input: '1 2\n3 4\n0 0\n', output: '3\n7\n' },
    code: {
      python: src`
import sys

def main():
    out = []
    for line in sys.stdin:
        parts = line.split()
        if not parts:
            continue
        a, b = int(parts[0]), int(parts[1])
        if a == 0 and b == 0:
            break
        out.append(str(a + b))
    print('\n'.join(out))

main()
`,
      cpp: src`
#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    long long a, b;
    while (cin >> a >> b && !(a == 0 && b == 0)) {
        cout << a + b << '\n';
    }
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            StringTokenizer st = new StringTokenizer(line);
            if (!st.hasMoreTokens()) continue;
            long a = Long.parseLong(st.nextToken());
            long b = Long.parseLong(st.nextToken());
            if (a == 0 && b == 0) break;
            out.append(a + b).append('\n');
        }
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    var a, b int64
    for {
        if _, err := fmt.Fscan(in, &a, &b); err != nil || (a == 0 && b == 0) {
            break
        }
        fmt.Fprintln(out, a+b)
    }
}
`,
    },
  },
  {
    id: 'array',
    title: { zh: '先给 n，再给一行 n 个数', en: 'n, then an array of n numbers' },
    note: {
      zh: '最常见的形态：第一行 n，第二行 n 个整数。求和可能超过 int 范围，用 long long / long / int64。示例：输出数组之和。',
      en: 'The most common shape: n on line 1, then n integers. A sum can overflow int, so use long long / long / int64. Example: print the sum.',
    },
    sample: { input: '5\n3 1 4 1 5\n', output: '14\n' },
    code: {
      python: src`
import sys

def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    print(sum(nums))

main()
`,
      cpp: src`
#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<long long> nums(n);
    for (auto &x : nums) cin >> x;
    long long sum = 0;
    for (long long x : nums) sum += x;
    cout << sum << '\n';
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        StringTokenizer st = new StringTokenizer(br.readLine());
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) nums[i] = Long.parseLong(st.nextToken());
        long sum = 0;
        for (long x : nums) sum += x;
        System.out.println(sum);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    var n int
    fmt.Fscan(in, &n)
    nums := make([]int64, n)
    for i := range nums {
        fmt.Fscan(in, &nums[i])
    }
    var sum int64
    for _, x := range nums {
        sum += x
    }
    fmt.Println(sum)
}
`,
    },
  },
  {
    id: 'matrix',
    title: { zh: 'n × m 矩阵', en: 'n × m matrix' },
    note: {
      zh: '第一行 n m，接着 n 行、每行 m 个数。用二维数组存，下标从 0 开始。示例：输出每一行的和。',
      en: 'Line 1 is n m, then n rows of m numbers each. Store a 2D array indexed from 0. Example: print the sum of each row.',
    },
    sample: { input: '2 3\n1 2 3\n4 5 6\n', output: '6\n15\n' },
    code: {
      python: src`
import sys

def main():
    input = sys.stdin.readline
    n, m = map(int, input().split())
    grid = [list(map(int, input().split()))[:m] for _ in range(n)]
    print('\n'.join(str(sum(row)) for row in grid))

main()
`,
      cpp: src`
#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<vector<long long>> grid(n, vector<long long>(m));
    for (auto &row : grid)
        for (auto &x : row) cin >> x;
    for (const auto &row : grid) {
        long long sum = 0;
        for (long long x : row) sum += x;
        cout << sum << '\n';
    }
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int n = Integer.parseInt(st.nextToken());
        int m = Integer.parseInt(st.nextToken());
        long[][] grid = new long[n][m];
        for (int i = 0; i < n; i++) {
            st = new StringTokenizer(br.readLine());
            for (int j = 0; j < m; j++) grid[i][j] = Long.parseLong(st.nextToken());
        }
        StringBuilder out = new StringBuilder();
        for (long[] row : grid) {
            long sum = 0;
            for (long x : row) sum += x;
            out.append(sum).append('\n');
        }
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    var n, m int
    fmt.Fscan(in, &n, &m)
    grid := make([][]int64, n)
    for i := range grid {
        grid[i] = make([]int64, m)
        for j := range grid[i] {
            fmt.Fscan(in, &grid[i][j])
        }
    }
    for _, row := range grid {
        var sum int64
        for _, x := range row {
            sum += x
        }
        fmt.Fprintln(out, sum)
    }
}
`,
    },
  },
  {
    id: 'char-grid',
    title: { zh: '字符网格（迷宫 / 地图）', en: 'Character grid (maze / map)' },
    note: {
      zh: '第一行 n m，接着 n 行字符串，每行 m 个字符，常见于迷宫和 BFS 题。按字符串整行读，再用 grid[i][j] 取格子。示例：数出 # 的个数。',
      en: 'Line 1 is n m, then n strings of m characters, typical for mazes and BFS. Read each row as a string and index grid[i][j]. Example: count the # cells.',
    },
    sample: { input: '3 4\n#..#\n.##.\n....\n', output: '4\n' },
    code: {
      python: src`
import sys

def main():
    input = sys.stdin.readline
    n, m = map(int, input().split())
    grid = [input().strip() for _ in range(n)]
    print(sum(row.count('#') for row in grid))

main()
`,
      cpp: src`
#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<string> grid(n);
    for (auto &row : grid) cin >> row;
    int count = 0;
    for (const auto &row : grid)
        for (char c : row) count += c == '#';
    cout << count << '\n';
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int n = Integer.parseInt(st.nextToken());
        int m = Integer.parseInt(st.nextToken());
        char[][] grid = new char[n][];
        for (int i = 0; i < n; i++) grid[i] = br.readLine().trim().toCharArray();
        int count = 0;
        for (char[] row : grid)
            for (char c : row) if (c == '#') count++;
        System.out.println(count);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    var n, m int
    fmt.Fscan(in, &n, &m)
    grid := make([]string, n)
    for i := range grid {
        fmt.Fscan(in, &grid[i])
    }
    count := 0
    for _, row := range grid {
        for _, c := range row {
            if c == '#' {
                count++
            }
        }
    }
    fmt.Println(count)
}
`,
    },
  },
  {
    id: 'graph',
    title: { zh: 'n 个点、m 条边建图', en: 'Graph from n nodes and m edges' },
    note: {
      zh: '第一行 n m，接着 m 行 u v（点编号从 1 开始）。用邻接表存图，无向图两个方向都要加。示例：从 1 号点 BFS，输出到每个点的最短距离，走不到输出 -1。',
      en: 'Line 1 is n m, then m lines u v with nodes numbered from 1. Store an adjacency list and add both directions for an undirected graph. Example: BFS from node 1 and print each distance, or -1 if unreachable.',
    },
    sample: { input: '5 3\n1 2\n2 3\n1 4\n', output: '0 1 2 1 -1\n' },
    code: {
      python: src`
import sys
from collections import deque

def main():
    it = iter(map(int, sys.stdin.read().split()))
    n, m = next(it), next(it)
    adj = [[] for _ in range(n + 1)]
    for _ in range(m):
        u, v = next(it), next(it)
        adj[u].append(v)
        adj[v].append(u)
    dist = [-1] * (n + 1)
    dist[1] = 0
    queue = deque([1])
    while queue:
        u = queue.popleft()
        for v in adj[u]:
            if dist[v] == -1:
                dist[v] = dist[u] + 1
                queue.append(v)
    print(' '.join(map(str, dist[1:])))

main()
`,
      cpp: src`
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<vector<int>> adj(n + 1);
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u >> v;
        adj[u].push_back(v);
        adj[v].push_back(u);
    }
    vector<int> dist(n + 1, -1);
    queue<int> q;
    dist[1] = 0;
    q.push(1);
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        for (int v : adj[u]) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                q.push(v);
            }
        }
    }
    for (int i = 1; i <= n; i++) cout << dist[i] << (i == n ? '\n' : ' ');
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int n = Integer.parseInt(st.nextToken());
        int m = Integer.parseInt(st.nextToken());
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
        for (int i = 0; i < m; i++) {
            st = new StringTokenizer(br.readLine());
            int u = Integer.parseInt(st.nextToken());
            int v = Integer.parseInt(st.nextToken());
            adj.get(u).add(v);
            adj.get(v).add(u);
        }
        int[] dist = new int[n + 1];
        Arrays.fill(dist, -1);
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        dist[1] = 0;
        queue.add(1);
        while (!queue.isEmpty()) {
            int u = queue.poll();
            for (int v : adj.get(u)) {
                if (dist[v] == -1) {
                    dist[v] = dist[u] + 1;
                    queue.add(v);
                }
            }
        }
        StringBuilder out = new StringBuilder();
        for (int i = 1; i <= n; i++) out.append(dist[i]).append(i == n ? '\n' : ' ');
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    var n, m int
    fmt.Fscan(in, &n, &m)
    adj := make([][]int, n+1)
    for i := 0; i < m; i++ {
        var u, v int
        fmt.Fscan(in, &u, &v)
        adj[u] = append(adj[u], v)
        adj[v] = append(adj[v], u)
    }
    dist := make([]int, n+1)
    for i := range dist {
        dist[i] = -1
    }
    dist[1] = 0
    queue := []int{1}
    for len(queue) > 0 {
        u := queue[0]
        queue = queue[1:]
        for _, v := range adj[u] {
            if dist[v] == -1 {
                dist[v] = dist[u] + 1
                queue = append(queue, v)
            }
        }
    }
    for i := 1; i <= n; i++ {
        if i > 1 {
            out.WriteByte(' ')
        }
        fmt.Fprint(out, dist[i])
    }
    out.WriteByte('\n')
}
`,
    },
  },
  {
    id: 'lines',
    title: { zh: '整行读入（含空格的字符串）', en: 'Whole lines with spaces' },
    note: {
      zh: '字符串里有空格时要按整行读。坑：C++ 先 cin >> n 再 getline，会读到 n 后面剩下的空行，要先多 getline 一次；Go 同理。示例：输出每行的单词数。',
      en: "Read whole lines when strings contain spaces. Pitfall: after cin >> n, the next getline returns the rest of n's line, so call getline once more first (same in Go). Example: print the word count of each line.",
    },
    sample: {
      input: '3\nhello world\n  a b  c\nsingle\n',
      output: '2\n3\n1\n',
    },
    code: {
      python: src`
import sys

def main():
    input = sys.stdin.readline
    n = int(input())
    out = []
    for _ in range(n):
        line = input().rstrip('\r\n')
        out.append(str(len(line.split())))
    print('\n'.join(out))

main()
`,
      cpp: src`
#include <iostream>
#include <sstream>
#include <string>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    string line;
    getline(cin, line); // the rest of n's line
    for (int i = 0; i < n; i++) {
        getline(cin, line);
        istringstream words(line);
        string word;
        int count = 0;
        while (words >> word) count++;
        cout << count << '\n';
    }
    return 0;
}
`,
      java: src`
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) {
            String line = br.readLine().trim();
            out.append(line.isEmpty() ? 0 : line.split("\\s+").length).append('\n');
        }
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    var n int
    fmt.Fscan(in, &n)
    in.ReadString('\n') // the rest of n's line
    for i := 0; i < n; i++ {
        line, _ := in.ReadString('\n')
        fmt.Fprintln(out, len(strings.Fields(line)))
    }
}
`,
    },
  },
  {
    id: 'ragged',
    title: { zh: '每行个数不定，读到结束', en: 'Lines of varying length until EOF' },
    note: {
      zh: '每行数字个数不固定、行数也不给时，逐行读，再把这一行拆开。空行直接跳过。示例：输出每行之和。',
      en: "When neither the count per line nor the number of lines is given, read line by line and split each one. Blank lines are skipped. Example: print each line's sum.",
    },
    sample: { input: '1 2 3\n4\n5 6\n', output: '6\n4\n11\n' },
    code: {
      python: src`
import sys

def main():
    out = []
    for line in sys.stdin:
        if line.strip():
            out.append(str(sum(map(int, line.split()))))
    print('\n'.join(out))

main()
`,
      cpp: src`
#include <iostream>
#include <sstream>
#include <string>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string line;
    while (getline(cin, line)) {
        istringstream nums(line);
        long long x, sum = 0;
        bool any = false;
        while (nums >> x) {
            sum += x;
            any = true;
        }
        if (any) cout << sum << '\n';
    }
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            StringTokenizer st = new StringTokenizer(line);
            if (!st.hasMoreTokens()) continue;
            long sum = 0;
            while (st.hasMoreTokens()) sum += Long.parseLong(st.nextToken());
            out.append(sum).append('\n');
        }
        System.out.print(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func main() {
    sc := bufio.NewScanner(os.Stdin)
    sc.Buffer(make([]byte, 1<<20), 1<<20) // lines up to 1 MB
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    for sc.Scan() {
        fields := strings.Fields(sc.Text())
        if len(fields) == 0 {
            continue
        }
        var sum int64
        for _, f := range fields {
            x, _ := strconv.ParseInt(f, 10, 64)
            sum += x
        }
        fmt.Fprintln(out, sum)
    }
}
`,
    },
  },
  {
    id: 'join',
    title: { zh: '空格分隔输出（行末无空格）', en: 'Space-separated output, no trailing space' },
    note: {
      zh: '一行输出多个数时用空格隔开。多数评测会忽略行末空格，但有的严格比对；用 join 或「不是第一个才加空格」最稳。示例：把数组倒序输出。',
      en: 'Separate the numbers on a line with spaces. Most judges ignore trailing spaces but some compare exactly; join, or add a space before every item except the first. Example: print the array reversed.',
    },
    sample: { input: '4\n1 2 3 4\n', output: '4 3 2 1\n' },
    code: {
      python: src`
import sys

def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = data[1:1 + n]
    print(' '.join(reversed(nums)))

main()
`,
      cpp: src`
#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<long long> nums(n);
    for (auto &x : nums) cin >> x;
    for (int i = n - 1; i >= 0; i--) {
        cout << nums[i] << (i == 0 ? '\n' : ' ');
    }
    return 0;
}
`,
      java: src`
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        StringTokenizer st = new StringTokenizer(br.readLine());
        String[] nums = new String[n];
        for (int i = 0; i < n; i++) nums[i] = st.nextToken();
        StringJoiner out = new StringJoiner(" ");
        for (int i = n - 1; i >= 0; i--) out.add(nums[i]);
        System.out.println(out);
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    var n int
    fmt.Fscan(in, &n)
    nums := make([]string, n)
    for i := range nums {
        fmt.Fscan(in, &nums[i])
    }
    for i, j := 0, n-1; i < j; i, j = i+1, j-1 {
        nums[i], nums[j] = nums[j], nums[i]
    }
    fmt.Println(strings.Join(nums, " "))
}
`,
    },
  },
  {
    id: 'fast',
    title: { zh: '快读快写（大数据量）', en: 'Fast I/O for large input' },
    note: {
      zh: '输入输出到 10^5～10^6 量级时，I/O 本身就可能超时。C++ 关同步（sync_with_stdio(false) + cin.tie(nullptr)）并用 \\n 代替 endl；Java 用 BufferedReader + StreamTokenizer 读、PrintWriter 写（StreamTokenizer 把数读成 double，超过 2^53 的整数会失真）；Go 用 bufio.Scanner 按词读、bufio.Writer 写；Python 用 sys.stdin.buffer 一次读完、最后一次 write。示例：输出前缀和。',
      en: 'At 10^5 to 10^6 numbers, I/O alone can time out. C++: turn off sync (sync_with_stdio(false) + cin.tie(nullptr)) and use \\n instead of endl. Java: BufferedReader + StreamTokenizer to read, PrintWriter to write (StreamTokenizer reads doubles, so integers past 2^53 lose precision). Go: bufio.Scanner by words, bufio.Writer for output. Python: read sys.stdin.buffer at once and write once. Example: print prefix sums.',
    },
    sample: { input: '5\n1 2 3 4 5\n', output: '1\n3\n6\n10\n15\n' },
    code: {
      python: src`
import sys

def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    out = []
    total = 0
    for i in range(1, n + 1):
        total += int(data[i])
        out.append(total)
    sys.stdout.write('\n'.join(map(str, out)) + '\n')

main()
`,
      cpp: src`
#include <iostream>
#include <string>
using namespace std;

int main() {
    ios::sync_with_stdio(false); // stop syncing with C stdio
    cin.tie(nullptr);            // don't flush cout before each read
    int n;
    cin >> n;
    long long total = 0;
    string out;
    for (int i = 0; i < n; i++) {
        long long x;
        cin >> x;
        total += x;
        out += to_string(total);
        out += '\n'; // endl would flush every line
    }
    cout << out;
    return 0;
}
`,
      java: src`
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));
        PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
        in.nextToken();
        int n = (int) in.nval;
        long total = 0;
        for (int i = 0; i < n; i++) {
            in.nextToken();
            total += (long) in.nval; // a double: exact up to 2^53
            out.println(total);
        }
        out.flush();
    }
}
`,
      go: src`
package main

import (
    "bufio"
    "os"
    "strconv"
)

func main() {
    sc := bufio.NewScanner(os.Stdin)
    sc.Buffer(make([]byte, 1<<20), 1<<20)
    sc.Split(bufio.ScanWords)
    readInt := func() int64 {
        sc.Scan()
        x, _ := strconv.ParseInt(sc.Text(), 10, 64)
        return x
    }
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()
    n := int(readInt())
    var total int64
    for i := 0; i < n; i++ {
        total += readInt()
        out.WriteString(strconv.FormatInt(total, 10))
        out.WriteByte('\n')
    }
}
`,
    },
  },
];
