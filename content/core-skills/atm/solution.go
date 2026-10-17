package main

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

// NOTES 从大到小 / largest first; each divides the next larger one.
var NOTES = []int{100, 50, 10}

const (
	LIMIT     = 2000 // 单笔上限 / per-withdrawal limit
	MAX_TRIES = 3
)

type Account struct {
	pin      string
	balance  int64
	failures int // 连续输错 PIN 的次数 / consecutive wrong PINs
	locked   bool
}

type CashDispenser struct{ counts map[int]int }

// Plan 贪心配钞 / Greedy notes, largest first (counts per note); ok false when the cassettes cannot pay exactly.
func (d *CashDispenser) Plan(amount int64) ([]int, bool) {
	notes := make([]int, len(NOTES))
	for i, note := range NOTES {
		take := int64(d.counts[note])
		if amount/int64(note) < take {
			take = amount / int64(note)
		}
		notes[i] = int(take)
		amount -= take * int64(note)
	}
	return notes, amount == 0
}

func (d *CashDispenser) Dispense(notes []int) {
	for i, note := range NOTES {
		d.counts[note] -= notes[i]
	}
}

// State 状态接口 / The state interface; BaseState answers "not now" to everything.
type State interface {
	Insert(atm *ATM, card string) string
	Pin(atm *ATM, pin string) string
	Balance(atm *ATM) string
	Withdraw(atm *ATM, amount int64) string
	Eject(atm *ATM) string
}

type BaseState struct{}

func (BaseState) Insert(*ATM, string) string   { return "NOT_NOW" }
func (BaseState) Pin(*ATM, string) string      { return "NOT_NOW" }
func (BaseState) Balance(*ATM) string          { return "NOT_NOW" }
func (BaseState) Withdraw(*ATM, int64) string  { return "NOT_NOW" }
func (BaseState) Eject(*ATM) string            { return "NOT_NOW" }

type IdleState struct{ BaseState }

func (IdleState) Insert(atm *ATM, card string) string {
	account := atm.accounts[card]
	if account == nil {
		return "UNKNOWN_CARD"
	}
	if account.locked {
		return "CARD_LOCKED"
	}
	atm.account, atm.state = account, CardInsertedState{}
	return "OK"
}

type CardInsertedState struct{ BaseState }

func (CardInsertedState) Pin(atm *ATM, pin string) string {
	account := atm.account
	if pin == account.pin {
		account.failures = 0
		atm.state = AuthenticatedState{}
		return "OK"
	}
	account.failures++
	if account.failures == MAX_TRIES {
		account.locked = true // 吞卡，结束会话 / keep the card, end the session
		atm.EndSession()
		return "LOCKED"
	}
	return "WRONG_PIN " + strconv.Itoa(MAX_TRIES-account.failures)
}

func (CardInsertedState) Eject(atm *ATM) string {
	atm.EndSession()
	return "OK"
}

type AuthenticatedState struct{ CardInsertedState }

func (AuthenticatedState) Pin(*ATM, string) string { return "NOT_NOW" }

func (AuthenticatedState) Balance(atm *ATM) string { return strconv.FormatInt(atm.account.balance, 10) }

func (AuthenticatedState) Withdraw(atm *ATM, amount int64) string {
	if amount <= 0 || amount%10 != 0 {
		return "BAD_AMOUNT"
	}
	if amount > LIMIT {
		return "OVER_LIMIT"
	}
	if amount > atm.account.balance {
		return "INSUFFICIENT_FUNDS"
	}
	notes, ok := atm.dispenser.Plan(amount)
	if !ok {
		return "NO_NOTES"
	}
	atm.account.balance -= amount // 先确认能出钞，再扣款 / debit only once the notes are certain
	atm.dispenser.Dispense(notes)
	var out []string
	for i, n := range notes {
		if n > 0 {
			out = append(out, strconv.Itoa(NOTES[i])+"x"+strconv.Itoa(n))
		}
	}
	return strings.Join(out, " ")
}

// ATM 门面，持有当前状态、会话里的账户和出钞机 / Facade: the current state, the session's account, the dispenser.
type ATM struct {
	dispenser *CashDispenser
	accounts  map[string]*Account
	account   *Account
	state     State
}

func NewATM(counts [3]int, pins map[string]string, balances map[string]int64) *ATM {
	atm := &ATM{
		dispenser: &CashDispenser{counts: map[int]int{10: counts[0], 50: counts[1], 100: counts[2]}},
		accounts:  map[string]*Account{},
		state:     IdleState{},
	}
	for card, pin := range pins {
		atm.accounts[card] = &Account{pin: pin, balance: balances[card]}
	}
	return atm
}

func (atm *ATM) EndSession() { atm.account, atm.state = nil, IdleState{} }

func (atm *ATM) Insert(card string) string       { return atm.state.Insert(atm, card) }
func (atm *ATM) Pin(pin string) string           { return atm.state.Pin(atm, pin) }
func (atm *ATM) Balance() string                 { return atm.state.Balance(atm) }
func (atm *ATM) Withdraw(amount int64) string    { return atm.state.Withdraw(atm, amount) }
func (atm *ATM) Eject() string                   { return atm.state.Eject(atm) }

func (atm *ATM) Cash() string {
	c := atm.dispenser.counts
	return strconv.Itoa(c[10]) + " " + strconv.Itoa(c[50]) + " " + strconv.Itoa(c[100])
}

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
