package main

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

// COINS 从大到小 / largest first; each divides the next larger one.
var COINS = []int{500, 100, 50, 10}

type Slot struct{ price, count int }

// MakeChange 贪心找零 / Greedy change from a limited pool, largest coin first; ok false: impossible.
// With 10 | 50 | 100 | 500 greedy finds change whenever any exists, with the fewest coins.
func MakeChange(amount int, pool map[int]int) ([]int, bool) {
	var change []int
	for _, coin := range COINS {
		take := pool[coin]
		if amount/coin < take {
			take = amount / coin
		}
		for k := 0; k < take; k++ {
			change = append(change, coin)
		}
		amount -= take * coin
	}
	return change, amount == 0
}

// VendingMachine 售货机 / Vending machine: a state, slots, the cash box and the customer's escrow.
type VendingMachine struct {
	cash   map[int]int // 机器自己的硬币 / coins the machine owns
	escrow []int       // 当前顾客投入的硬币 / the current customer's coins
	slots  map[string]*Slot
	state  string
}

func NewVendingMachine(cash map[int]int) *VendingMachine {
	return &VendingMachine{cash: cash, slots: map[string]*Slot{}, state: "IDLE"}
}

func (m *VendingMachine) paid() int {
	sum := 0
	for _, coin := range m.escrow {
		sum += coin
	}
	return sum
}

func (m *VendingMachine) Insert(coin int) string {
	if m.state == "OUT_OF_SERVICE" {
		return "NOT_NOW"
	}
	if coin != 10 && coin != 50 && coin != 100 && coin != 500 {
		return "REJECTED"
	}
	m.escrow = append(m.escrow, coin)
	m.state = "HAS_MONEY"
	return strconv.Itoa(m.paid())
}

func (m *VendingMachine) Select(code string) string {
	if m.state != "HAS_MONEY" {
		return "NOT_NOW"
	}
	slot := m.slots[code]
	if slot == nil || slot.count == 0 {
		return "SOLD_OUT"
	}
	if m.paid() < slot.price {
		return "INSUFFICIENT " + strconv.Itoa(slot.price-m.paid())
	}
	pool := map[int]int{}
	for coin, n := range m.cash {
		pool[coin] = n
	}
	for _, coin := range m.escrow { // 投入的硬币也能找出去 / inserted coins can go back out as change
		pool[coin]++
	}
	change, ok := MakeChange(m.paid()-slot.price, pool)
	if !ok {
		return "NO_CHANGE" // 押金原封不动 / escrow untouched
	}
	out := []string{code}
	for _, coin := range change { // 一次提交 / commit in one step
		pool[coin]--
		out = append(out, strconv.Itoa(coin))
	}
	m.cash, m.escrow = pool, nil
	slot.count--
	m.state = "IDLE"
	return strings.Join(out, " ")
}

func (m *VendingMachine) Cancel() string {
	if m.state != "HAS_MONEY" {
		return "NOT_NOW"
	}
	out := make([]string, len(m.escrow))
	for i, coin := range m.escrow { // 原样退回 / the very coins inserted
		out[i] = strconv.Itoa(coin)
	}
	m.escrow = nil
	m.state = "IDLE"
	return strings.Join(out, " ")
}

func (m *VendingMachine) Service() string {
	if m.state != "IDLE" {
		return "NOT_NOW"
	}
	m.state = "OUT_OF_SERVICE"
	return "OK"
}

func (m *VendingMachine) Restock(code string, price, count int) string {
	if m.state != "OUT_OF_SERVICE" {
		return "NOT_NOW"
	}
	if m.slots[code] == nil {
		m.slots[code] = &Slot{}
	}
	m.slots[code].price = price
	m.slots[code].count += count
	return "OK"
}

func (m *VendingMachine) Resume() string {
	if m.state != "OUT_OF_SERVICE" {
		return "NOT_NOW"
	}
	m.state = "IDLE"
	return "OK"
}

func (m *VendingMachine) CashBox() string {
	return strconv.Itoa(m.cash[10]) + " " + strconv.Itoa(m.cash[50]) + " " + strconv.Itoa(m.cash[100]) + " " + strconv.Itoa(m.cash[500])
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	cash := map[int]int{}
	for _, coin := range []int{10, 50, 100, 500} {
		cash[coin] = nextInt()
	}
	machine := NewVendingMachine(cash)
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "insert":
			w.WriteString(machine.Insert(nextInt()))
		case "select":
			w.WriteString(machine.Select(next()))
		case "cancel":
			w.WriteString(machine.Cancel())
		case "service":
			w.WriteString(machine.Service())
		case "restock":
			code := next()
			price := nextInt()
			w.WriteString(machine.Restock(code, price, nextInt()))
		case "resume":
			w.WriteString(machine.Resume())
		default:
			w.WriteString(machine.CashBox())
		}
		w.WriteByte('\n')
	}
}
