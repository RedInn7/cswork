package main

import (
	"bufio"
	"os"
	"strconv"
)

// VendingMachine 售货机 / Vending machine. 状态 / states: IDLE, HAS_MONEY, OUT_OF_SERVICE. 收 / accepts 10, 50, 100, 500.
// 建议拆出 / Suggested: Slot（价格和库存 / price and stock）, MakeChange（贪心找零 / greedy change）;
// 顾客的硬币（押金）和机器的钱箱分开放 / keep the customer's escrow apart from the cash box.
type VendingMachine struct {
	// TODO
}

// NewVendingMachine cash[coin]: 钱箱里该面值的硬币数 / coins of each value in the cash box.
func NewVendingMachine(cash map[int]int) *VendingMachine {
	return &VendingMachine{} // TODO
}

func (m *VendingMachine) Insert(coin int) string { return "" } // TODO: 已投总额 / the escrow total, "REJECTED" or "NOT_NOW"

func (m *VendingMachine) Select(code string) string { return "" } // TODO: "<code> <change...>", "SOLD_OUT", "INSUFFICIENT <n>", "NO_CHANGE", "NOT_NOW"

func (m *VendingMachine) Cancel() string { return "" } // TODO: 按投入顺序退回 / the coins back in the order inserted, or "NOT_NOW"

func (m *VendingMachine) Service() string { return "" } // TODO: "OK" or "NOT_NOW"

func (m *VendingMachine) Restock(code string, price, count int) string { return "" } // TODO: "OK" or "NOT_NOW"

func (m *VendingMachine) Resume() string { return "" } // TODO: "OK" or "NOT_NOW"

func (m *VendingMachine) CashBox() string { return "" } // TODO: 钱箱里 10 50 100 500 各几枚 / coins of 10 50 100 500

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
