package main

import (
	"bufio"
	"os"
	"strconv"
)

// Group 一组人的账本 / A group's ledger.
// 建议拆出 / Suggested: 三种分账规则（策略） / three split rules (strategies), EQUAL, EXACT and PERCENT,
// each turning an amount into cents owed per participant; 只存每人的净额 / keep net balances only.
type Group struct {
	// TODO
}

func NewGroup() *Group { return &Group{} } // TODO

// AddExpense kind: "EQUAL"（values 为空 / values empty）, "EXACT"（金额 / cents）, "PERCENT"（万分比 / basis points）.
func (g *Group) AddExpense(payer string, amount int64, kind string, people []string, values []int64) string {
	return "" // TODO: 各人份额 / each share in order, or "INVALID"
}

func (g *Group) Pay(from, to string, amount int64) string { return "" } // TODO: "OK"

func (g *Group) Balance(user string) int64 { return 0 } // TODO: 净额，> 0 别人欠他 / net, > 0 means owed money

func (g *Group) Settle() string { return "" } // TODO: "<count> <from> <to> <amount> ..."

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int64 { v, _ := strconv.ParseInt(next(), 10, 64); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	group := NewGroup()
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "expense":
			payer := next()
			amount := nextInt()
			kind := next()
			var people []string
			var values []int64
			for k := nextInt(); k > 0; k-- {
				people = append(people, next())
				if kind != "EQUAL" {
					values = append(values, nextInt())
				}
			}
			w.WriteString(group.AddExpense(payer, amount, kind, people, values))
		case "pay":
			from, to := next(), next()
			w.WriteString(group.Pay(from, to, nextInt()))
		case "balance":
			w.WriteString(strconv.FormatInt(group.Balance(next()), 10))
		default:
			w.WriteString(group.Settle())
		}
		w.WriteByte('\n')
	}
}
