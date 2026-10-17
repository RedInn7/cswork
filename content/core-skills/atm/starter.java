import java.io.*;
import java.util.*;

// ATM / Cash machine.
// 建议用状态模式 / Suggested: the State pattern, an interface whose default methods return "NOT_NOW",
// implemented by IdleState, CardInsertedState, AuthenticatedState, each overriding only what it allows.
// 再拆出 / plus Account（PIN、余额、连续输错次数 / PIN, balance, wrong tries）and CashDispenser（配钞 / notes）.
class ATM {
    // counts: 10、50、100 面额的张数 / notes of 10, 50, 100; pins / balances by card
    ATM(int[] counts, Map<String, String> pins, Map<String, Long> balances) {
        // TODO
    }

    String insert(String card) { return ""; } // TODO: "OK", "UNKNOWN_CARD", "CARD_LOCKED", "NOT_NOW"
    String pin(String pin) { return ""; } // TODO: "OK", "WRONG_PIN <left>", "LOCKED", "NOT_NOW"
    String balance() { return ""; } // TODO: 余额 / the balance, or "NOT_NOW"
    String withdraw(long amount) { return ""; } // TODO: "100x1 10x2", "BAD_AMOUNT", "OVER_LIMIT", "INSUFFICIENT_FUNDS", "NO_NOTES", "NOT_NOW"
    String eject() { return ""; } // TODO: "OK" or "NOT_NOW"
    String cash() { return ""; } // TODO: 10、50、100 面额各剩几张 / notes of 10, 50, 100 left
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
        int[] counts = {nextInt(), nextInt(), nextInt()};
        Map<String, String> pins = new HashMap<>();
        Map<String, Long> balances = new HashMap<>();
        for (int n = nextInt(); n > 0; n--) {
            String card = next();
            pins.put(card, next());
            balances.put(card, Long.parseLong(next()));
        }
        ATM atm = new ATM(counts, pins, balances);
        StringBuilder out = new StringBuilder();
        for (int q = nextInt(); q > 0; q--) {
            switch (next()) {
                case "insert" -> out.append(atm.insert(next()));
                case "pin" -> out.append(atm.pin(next()));
                case "balance" -> out.append(atm.balance());
                case "withdraw" -> out.append(atm.withdraw(Long.parseLong(next())));
                case "eject" -> out.append(atm.eject());
                default -> out.append(atm.cash());
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
