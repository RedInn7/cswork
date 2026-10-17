import java.io.*;
import java.util.*;

// 售货机 / Vending machine. 状态 / states: IDLE, HAS_MONEY, OUT_OF_SERVICE. 收 / accepts 10, 50, 100, 500.
// 建议拆出 / Suggested: Slot（价格和库存 / price and stock）, makeChange（贪心找零 / greedy change）;
// 顾客的硬币（押金）和机器的钱箱分开放 / keep the customer's escrow apart from the cash box.
class VendingMachine {
    VendingMachine(Map<Integer, Integer> cash) {
        // TODO: cash.get(coin): 钱箱里该面值的硬币数 / coins of each value in the cash box
    }

    String insert(int coin) {
        return ""; // TODO: 已投总额 / the escrow total, "REJECTED" or "NOT_NOW"
    }

    String select(String code) {
        return ""; // TODO: "<code> <change...>", "SOLD_OUT", "INSUFFICIENT <n>", "NO_CHANGE", "NOT_NOW"
    }

    String cancel() {
        return ""; // TODO: 按投入顺序退回 / the coins back in the order inserted, or "NOT_NOW"
    }

    String service() {
        return ""; // TODO: "OK" or "NOT_NOW"
    }

    String restock(String code, int price, int count) {
        return ""; // TODO: "OK" or "NOT_NOW"
    }

    String resume() {
        return ""; // TODO: "OK" or "NOT_NOW"
    }

    String cashBox() {
        return ""; // TODO: 钱箱里 10 50 100 500 各几枚 / coins of 10 50 100 500 in the cash box
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
