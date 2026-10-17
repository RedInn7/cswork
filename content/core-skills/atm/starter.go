package main

import (
	"bufio"
	"os"
	"strconv"
)

// ATM / Cash machine.
// 建议用状态模式 / Suggested: the State pattern, a State interface implemented by IdleState,
// CardInsertedState and AuthenticatedState (embed a base type that answers "NOT_NOW").
// 再拆出 / plus Account（PIN、余额、连续输错次数 / PIN, balance, wrong tries）and CashDispenser（配钞 / notes）.
type ATM struct {
	// TODO
}

// NewATM counts: 10、50、100 面额的张数 / notes of 10, 50, 100; pins / balances by card.
func NewATM(counts [3]int, pins map[string]string, balances map[string]int64) *ATM {
	return &ATM{} // TODO
}

func (atm *ATM) Insert(card string) string    { return "" } // TODO: "OK", "UNKNOWN_CARD", "CARD_LOCKED", "NOT_NOW"
func (atm *ATM) Pin(pin string) string        { return "" } // TODO: "OK", "WRONG_PIN <left>", "LOCKED", "NOT_NOW"
func (atm *ATM) Balance() string              { return "" } // TODO: 余额 / the balance, or "NOT_NOW"
func (atm *ATM) Withdraw(amount int64) string { return "" } // TODO: "100x1 10x2", "BAD_AMOUNT", "OVER_LIMIT", "INSUFFICIENT_FUNDS", "NO_NOTES", "NOT_NOW"
func (atm *ATM) Eject() string                { return "" } // TODO: "OK" or "NOT_NOW"
func (atm *ATM) Cash() string                 { return "" } // TODO: 10、50、100 面额各剩几张 / notes of 10, 50, 100 left

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int64 { v, _ := strconv.ParseInt(next(), 10, 64); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	var counts [3]int
	for i := range counts {
		counts[i] = int(nextInt())
	}
	pins, balances := map[string]string{}, map[string]int64{}
	for n := nextInt(); n > 0; n-- {
		card := next()
		pins[card] = next()
		balances[card] = nextInt()
	}
	atm := NewATM(counts, pins, balances)
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "insert":
			w.WriteString(atm.Insert(next()))
		case "pin":
			w.WriteString(atm.Pin(next()))
		case "balance":
			w.WriteString(atm.Balance())
		case "withdraw":
			w.WriteString(atm.Withdraw(nextInt()))
		case "eject":
			w.WriteString(atm.Eject())
		default:
			w.WriteString(atm.Cash())
		}
		w.WriteByte('\n')
	}
}
