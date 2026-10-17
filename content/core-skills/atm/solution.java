import java.io.*;
import java.util.*;

class Account {
    final String pin;
    long balance;
    int failures; // 连续输错 PIN 的次数 / consecutive wrong PINs
    boolean locked;

    Account(String pin, long balance) {
        this.pin = pin;
        this.balance = balance;
    }
}

class CashDispenser {
    static final int[] NOTES = {100, 50, 10}; // 从大到小 / largest first; each divides the next larger one
    final Map<Integer, Integer> counts = new HashMap<>();

    // 贪心配钞 / Greedy notes, largest first (counts per note); null when the cassettes cannot pay exactly.
    int[] plan(long amount) {
        int[] notes = new int[NOTES.length];
        for (int i = 0; i < NOTES.length; i++) {
            notes[i] = (int) Math.min(counts.get(NOTES[i]), amount / NOTES[i]);
            amount -= (long) notes[i] * NOTES[i];
        }
        return amount == 0 ? notes : null;
    }

    void dispense(int[] notes) {
        for (int i = 0; i < NOTES.length; i++) counts.merge(NOTES[i], -notes[i], Integer::sum);
    }
}

// 状态接口：默认都是“现在不行” / The state interface: every action defaults to "not now".
interface State {
    default String insert(ATM atm, String card) { return "NOT_NOW"; }
    default String pin(ATM atm, String pin) { return "NOT_NOW"; }
    default String balance(ATM atm) { return "NOT_NOW"; }
    default String withdraw(ATM atm, long amount) { return "NOT_NOW"; }
    default String eject(ATM atm) { return "NOT_NOW"; }
}

class IdleState implements State {
    public String insert(ATM atm, String card) {
        Account account = atm.accounts.get(card);
        if (account == null) return "UNKNOWN_CARD";
        if (account.locked) return "CARD_LOCKED";
        atm.account = account;
        atm.state = ATM.CARD_INSERTED;
        return "OK";
    }
}

class CardInsertedState implements State {
    public String pin(ATM atm, String pin) {
        Account account = atm.account;
        if (pin.equals(account.pin)) {
            account.failures = 0;
            atm.state = ATM.AUTHENTICATED;
            return "OK";
        }
        if (++account.failures == ATM.MAX_TRIES) {
            account.locked = true; // 吞卡，结束会话 / keep the card, end the session
            atm.endSession();
            return "LOCKED";
        }
        return "WRONG_PIN " + (ATM.MAX_TRIES - account.failures);
    }

    public String eject(ATM atm) {
        atm.endSession();
        return "OK";
    }
}

class AuthenticatedState extends CardInsertedState {
    public String pin(ATM atm, String pin) {
        return "NOT_NOW";
    }

    public String balance(ATM atm) {
        return String.valueOf(atm.account.balance);
    }

    public String withdraw(ATM atm, long amount) {
        if (amount <= 0 || amount % 10 != 0) return "BAD_AMOUNT";
        if (amount > ATM.LIMIT) return "OVER_LIMIT";
        if (amount > atm.account.balance) return "INSUFFICIENT_FUNDS";
        int[] notes = atm.dispenser.plan(amount);
        if (notes == null) return "NO_NOTES";
        atm.account.balance -= amount; // 先确认能出钞，再扣款 / debit only once the notes are certain
        atm.dispenser.dispense(notes);
        StringJoiner out = new StringJoiner(" ");
        for (int i = 0; i < notes.length; i++)
            if (notes[i] > 0) out.add(CashDispenser.NOTES[i] + "x" + notes[i]);
        return out.toString();
    }
}

// ATM：门面，持有当前状态、会话里的账户和出钞机 / Facade: the current state, the session's account, the dispenser.
class ATM {
    static final int LIMIT = 2000; // 单笔上限 / per-withdrawal limit
    static final int MAX_TRIES = 3;
    static final State IDLE = new IdleState(), CARD_INSERTED = new CardInsertedState(), AUTHENTICATED = new AuthenticatedState();

    final CashDispenser dispenser = new CashDispenser();
    final Map<String, Account> accounts = new HashMap<>();
    Account account;
    State state = IDLE;

    ATM(int[] counts, Map<String, String> pins, Map<String, Long> balances) {
        dispenser.counts.put(10, counts[0]);
        dispenser.counts.put(50, counts[1]);
        dispenser.counts.put(100, counts[2]);
        for (String card : pins.keySet()) accounts.put(card, new Account(pins.get(card), balances.get(card)));
    }

    void endSession() {
        account = null;
        state = IDLE;
    }

    String insert(String card) { return state.insert(this, card); }
    String pin(String pin) { return state.pin(this, pin); }
    String balance() { return state.balance(this); }
    String withdraw(long amount) { return state.withdraw(this, amount); }
    String eject() { return state.eject(this); }

    String cash() {
        return dispenser.counts.get(10) + " " + dispenser.counts.get(50) + " " + dispenser.counts.get(100);
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
