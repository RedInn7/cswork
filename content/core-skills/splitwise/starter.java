import java.io.*;
import java.util.*;

// 一组人的账本 / A group's ledger.
// 建议拆出 / Suggested: 三种分账规则（策略） / three split rules (strategies), EQUAL, EXACT and PERCENT,
// each turning an amount into cents owed per participant; 只存每人的净额 / keep net balances only.
class Group {
    // kind: "EQUAL"（values 为空 / values empty）, "EXACT"（金额 / cents）, "PERCENT"（万分比 / basis points）
    String addExpense(String payer, long amount, String kind, List<String> people, long[] values) {
        return ""; // TODO: 各人份额 / each share in order, or "INVALID"
    }

    String pay(String from, String to, long amount) {
        return ""; // TODO: "OK"
    }

    long balance(String user) {
        return 0; // TODO: 净额，> 0 别人欠他 / net, > 0 means owed money
    }

    String settle() {
        return ""; // TODO: "<count> <from> <to> <amount> ..."
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
