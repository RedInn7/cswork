import java.io.*;
import java.util.*;

class Slot {
    int price, count;
}

// 售货机 / Vending machine: a state, slots, the cash box and the customer's escrow.
class VendingMachine {
    static final int[] COINS = {500, 100, 50, 10}; // 从大到小 / largest first; each divides the next larger one

    private Map<Integer, Integer> cash; // 机器自己的硬币 / coins the machine owns
    private final List<Integer> escrow = new ArrayList<>(); // 当前顾客投入的硬币 / the current customer's coins
    private final Map<String, Slot> slots = new HashMap<>();
    private String state = "IDLE";

    VendingMachine(Map<Integer, Integer> cash) {
        this.cash = new HashMap<>(cash);
    }

    // 贪心找零 / Greedy change from a limited pool, largest coin first; null: impossible.
    // With 10 | 50 | 100 | 500 greedy finds change whenever any exists, with the fewest coins.
    static List<Integer> makeChange(int amount, Map<Integer, Integer> pool) {
        List<Integer> change = new ArrayList<>();
        for (int coin : COINS) {
            int take = Math.min(pool.getOrDefault(coin, 0), amount / coin);
            for (int k = 0; k < take; k++) change.add(coin);
            amount -= take * coin;
        }
        return amount == 0 ? change : null;
    }

    private int paid() {
        int sum = 0;
        for (int coin : escrow) sum += coin;
        return sum;
    }

    String insert(int coin) {
        if (state.equals("OUT_OF_SERVICE")) return "NOT_NOW";
        if (coin != 10 && coin != 50 && coin != 100 && coin != 500) return "REJECTED";
        escrow.add(coin);
        state = "HAS_MONEY";
        return String.valueOf(paid());
    }

    String select(String code) {
        if (!state.equals("HAS_MONEY")) return "NOT_NOW";
        Slot slot = slots.get(code);
        if (slot == null || slot.count == 0) return "SOLD_OUT";
        if (paid() < slot.price) return "INSUFFICIENT " + (slot.price - paid());
        Map<Integer, Integer> pool = new HashMap<>(cash);
        for (int coin : escrow) pool.merge(coin, 1, Integer::sum); // 投入的硬币也能找出去 / inserted coins can go back out
        List<Integer> change = makeChange(paid() - slot.price, pool);
        if (change == null) return "NO_CHANGE"; // 押金原封不动 / escrow untouched
        StringBuilder out = new StringBuilder(code);
        for (int coin : change) { // 一次提交 / commit in one step
            pool.merge(coin, -1, Integer::sum);
            out.append(' ').append(coin);
        }
        cash = pool;
        escrow.clear();
        slot.count--;
        state = "IDLE";
        return out.toString();
    }

    String cancel() {
        if (!state.equals("HAS_MONEY")) return "NOT_NOW";
        StringJoiner out = new StringJoiner(" ");
        for (int coin : escrow) out.add(String.valueOf(coin)); // 原样退回 / the very coins inserted
        escrow.clear();
        state = "IDLE";
        return out.toString();
    }

    String service() {
        if (!state.equals("IDLE")) return "NOT_NOW";
        state = "OUT_OF_SERVICE";
        return "OK";
    }

    String restock(String code, int price, int count) {
        if (!state.equals("OUT_OF_SERVICE")) return "NOT_NOW";
        Slot slot = slots.computeIfAbsent(code, k -> new Slot());
        slot.price = price;
        slot.count += count;
        return "OK";
    }

    String resume() {
        if (!state.equals("OUT_OF_SERVICE")) return "NOT_NOW";
        state = "IDLE";
        return "OK";
    }

    String cashBox() {
        StringJoiner out = new StringJoiner(" ");
        for (int coin : new int[] {10, 50, 100, 500}) out.add(String.valueOf(cash.getOrDefault(coin, 0)));
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

    private static int nextInt() {
        return Integer.parseInt(next());
    }

    public static void main(String[] args) throws IOException {
        in = System.in.readAllBytes();
        Map<Integer, Integer> cash = new HashMap<>();
        for (int coin : new int[] {10, 50, 100, 500}) cash.put(coin, nextInt());
        VendingMachine machine = new VendingMachine(cash);
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "insert" -> out.append(machine.insert(nextInt()));
                case "select" -> out.append(machine.select(next()));
                case "cancel" -> out.append(machine.cancel());
                case "service" -> out.append(machine.service());
                case "restock" -> {
                    String code = next();
                    int price = nextInt();
                    out.append(machine.restock(code, price, nextInt()));
                }
                case "resume" -> out.append(machine.resume());
                default -> out.append(machine.cashBox());
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
