import java.io.*;
import java.util.*;

// 分账规则（策略） / Split rules (strategies): cents owed per participant, or null when invalid.
interface SplitRule {
    long[] shares(long amount, List<String> people, long[] values);
}

class EqualSplit implements SplitRule {
    public long[] shares(long amount, List<String> people, long[] values) {
        int k = people.size();
        long[] shares = new long[k];
        for (int i = 0; i < k; i++) shares[i] = amount / k + (i < amount % k ? 1 : 0);
        return shares;
    }
}

class ExactSplit implements SplitRule {
    public long[] shares(long amount, List<String> people, long[] values) {
        return Arrays.stream(values).sum() == amount ? values.clone() : null;
    }
}

// 万分比，向下取整，剩下的分按余数从大到小补，余数相同按列出顺序 / round down, leftover cents by remainder.
class PercentSplit implements SplitRule {
    public long[] shares(long amount, List<String> people, long[] bps) {
        if (Arrays.stream(bps).sum() != 10000) return null;
        int k = bps.length;
        long[] shares = new long[k];
        long left = amount;
        for (int i = 0; i < k; i++) left -= shares[i] = amount * bps[i] / 10000;
        Integer[] order = new Integer[k];
        for (int i = 0; i < k; i++) order[i] = i;
        Arrays.sort(order, (a, b) -> Long.compare(amount * bps[b] % 10000, amount * bps[a] % 10000)); // stable
        for (int i = 0; i < left; i++) shares[order[i]]++;
        return shares;
    }
}

// 一组人的账本 / A group's ledger: net balances, > 0 is owed money, < 0 owes.
class Group {
    private static final Map<String, SplitRule> RULES =
            Map.of("EQUAL", new EqualSplit(), "EXACT", new ExactSplit(), "PERCENT", new PercentSplit());
    private final Map<String, Long> net = new HashMap<>();

    String addExpense(String payer, long amount, String kind, List<String> people, long[] values) {
        long[] shares = RULES.get(kind).shares(amount, people, values);
        if (shares == null) return "INVALID";
        net.merge(payer, amount, Long::sum);
        StringJoiner out = new StringJoiner(" ");
        for (int i = 0; i < shares.length; i++) {
            net.merge(people.get(i), -shares[i], Long::sum);
            out.add(String.valueOf(shares[i]));
        }
        return out.toString();
    }

    String pay(String from, String to, long amount) {
        net.merge(from, amount, Long::sum);
        net.merge(to, -amount, Long::sum);
        return "OK";
    }

    long balance(String user) {
        return net.getOrDefault(user, 0L);
    }

    private record Entry(long amount, String name) {}

    // 最大债务人付给最大债权人，金额相同按名字 / Largest debtor pays largest creditor; ties by name.
    String settle() {
        Comparator<Entry> largestFirst =
                Comparator.comparingLong((Entry e) -> -e.amount()).thenComparing(Entry::name);
        PriorityQueue<Entry> debtors = new PriorityQueue<>(largestFirst), creditors = new PriorityQueue<>(largestFirst);
        net.forEach((user, v) -> {
            if (v < 0) debtors.add(new Entry(-v, user));
            if (v > 0) creditors.add(new Entry(v, user));
        });
        List<String> transfers = new ArrayList<>();
        while (!debtors.isEmpty() && !creditors.isEmpty()) {
            Entry d = debtors.poll(), c = creditors.poll();
            long pay = Math.min(d.amount(), c.amount());
            transfers.add(d.name() + " " + c.name() + " " + pay);
            if (d.amount() > pay) debtors.add(new Entry(d.amount() - pay, d.name()));
            if (c.amount() > pay) creditors.add(new Entry(c.amount() - pay, c.name()));
        }
        StringJoiner out = new StringJoiner(" ");
        out.add(String.valueOf(transfers.size()));
        transfers.forEach(out::add);
        return out.toString();
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
        Group group = new Group();
        StringBuilder out = new StringBuilder();
        for (int q = Integer.parseInt(next()); q > 0; q--) {
            switch (next()) {
                case "expense" -> {
                    String payer = next();
                    long amount = Long.parseLong(next());
                    String kind = next();
                    int k = Integer.parseInt(next());
                    List<String> people = new ArrayList<>();
                    long[] values = new long[kind.equals("EQUAL") ? 0 : k];
                    for (int i = 0; i < k; i++) {
                        people.add(next());
                        if (!kind.equals("EQUAL")) values[i] = Long.parseLong(next());
                    }
                    out.append(group.addExpense(payer, amount, kind, people, values));
                }
                case "pay" -> {
                    String from = next(), to = next();
                    out.append(group.pay(from, to, Long.parseLong(next())));
                }
                case "balance" -> out.append(group.balance(next()));
                default -> out.append(group.settle());
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
