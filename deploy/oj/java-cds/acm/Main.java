import java.io.*;
import java.math.BigInteger;
import java.util.*;
import java.util.stream.*;

// Training run for the JVM's class-data-sharing archive (build-java-cds.sh):
// the JDK classes typical ACM programs load. Its output is not checked.
public class Main {
    record Edge(int to, long w) {}

    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int n = Integer.parseInt(st.nextToken());
        long[] a = Arrays.stream(br.readLine().trim().split("\\s+")).mapToLong(Long::parseLong).toArray();
        Scanner sc = new Scanner(br.readLine());
        String word = sc.next();
        StreamTokenizer tok = new StreamTokenizer(new StringReader(br.readLine()));
        tok.nextToken();
        double d = tok.nval;
        PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
        List<List<Edge>> g = new ArrayList<>();
        for (int i = 0; i < n; i++) g.add(new ArrayList<>());
        for (int i = 0; i + 1 < n; i++) g.get(i).add(new Edge(i + 1, a[i]));
        PriorityQueue<long[]> pq = new PriorityQueue<>((x, y) -> Long.compare(x[0], y[0]));
        long[] dist = new long[n];
        Arrays.fill(dist, Long.MAX_VALUE);
        dist[0] = 0;
        pq.add(new long[] {0, 0});
        while (!pq.isEmpty()) {
            long[] cur = pq.poll();
            for (Edge e : g.get((int) cur[1]))
                if (cur[0] + e.w() < dist[e.to()]) pq.add(new long[] {dist[e.to()] = cur[0] + e.w(), e.to()});
        }
        Map<String, Integer> count = new HashMap<>();
        for (char c : word.toCharArray()) count.merge(String.valueOf(c), 1, Integer::sum);
        TreeMap<Long, Integer> tm = new TreeMap<>();
        Set<Long> seen = new HashSet<>(), sorted = new TreeSet<>(Collections.reverseOrder());
        Deque<Integer> dq = new ArrayDeque<>();
        for (int i = 0; i < n; i++) { tm.put(a[i], i); seen.add(a[i]); sorted.add(a[i]); dq.offerLast(i); }
        Integer[] boxed = new Integer[n];
        for (int i = 0; i < n; i++) boxed[i] = (int) a[i];
        Arrays.sort(boxed, Comparator.comparingInt((Integer x) -> -x).thenComparing(x -> x));
        int[] prim = Arrays.stream(boxed).mapToInt(Integer::intValue).sorted().toArray();
        String joined = IntStream.of(prim).mapToObj(String::valueOf).collect(Collectors.joining(" "));
        Map<Boolean, List<Long>> parts = LongStream.of(a).boxed().collect(Collectors.partitioningBy(x -> x % 2 == 0));
        BigInteger big = BigInteger.ONE;
        for (long x : a) big = big.multiply(BigInteger.valueOf(x));
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("%.3f %d%n", d + Math.sqrt(dist[n - 1]), big.mod(BigInteger.valueOf(1_000_000_007L)).longValue()));
        sb.append(joined).append(' ').append(count).append(' ').append(tm.firstKey()).append(' ').append(parts.get(true).size());
        sb.append(' ').append(seen.size() + sorted.size() + dq.size()).append(' ').append(Objects.hash(word, n));
        out.println(sb);
        out.printf("%s %b%n", Arrays.toString(a), Optional.ofNullable(word).isPresent());
        out.flush();
        System.out.println(Long.MAX_VALUE / 3 + " " + Integer.toBinaryString(n) + " " + Character.isDigit(word.charAt(0)));
    }
}
