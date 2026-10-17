package main

import (
	"bufio"
	"container/heap"
	"os"
	"sort"
	"strconv"
	"strings"
)

func sum(values []int64) int64 {
	total := int64(0)
	for _, v := range values {
		total += v
	}
	return total
}

func SplitEqual(amount int64, k int) []int64 {
	shares := make([]int64, k)
	for i := range shares {
		shares[i] = amount / int64(k)
		if int64(i) < amount%int64(k) {
			shares[i]++
		}
	}
	return shares
}

func SplitExact(amount int64, values []int64) []int64 {
	if sum(values) != amount {
		return nil
	}
	return values
}

// SplitPercent 万分比，向下取整，剩下的分按余数从大到小补，余数相同按列出顺序 / round down, leftover cents by remainder.
func SplitPercent(amount int64, bps []int64) []int64 {
	if sum(bps) != 10000 {
		return nil
	}
	shares := make([]int64, len(bps))
	order := make([]int, len(bps))
	for i, bp := range bps {
		shares[i] = amount * bp / 10000
		order[i] = i
	}
	left := amount - sum(shares)
	sort.SliceStable(order, func(a, b int) bool { return amount*bps[order[a]]%10000 > amount*bps[order[b]]%10000 })
	for i := int64(0); i < left; i++ {
		shares[order[i]]++
	}
	return shares
}

// Entry 金额大的在前，相同按名字 / largest amount first, then by name.
type Entry struct {
	amount int64
	name   string
}
type Entries []Entry

func (h Entries) Len() int { return len(h) }
func (h Entries) Less(i, j int) bool {
	if h[i].amount != h[j].amount {
		return h[i].amount > h[j].amount
	}
	return h[i].name < h[j].name
}
func (h Entries) Swap(i, j int)        { h[i], h[j] = h[j], h[i] }
func (h *Entries) Push(x interface{}) { *h = append(*h, x.(Entry)) }
func (h *Entries) Pop() interface{} {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

// Group 一组人的账本 / A group's ledger: net balances, > 0 is owed money, < 0 owes.
type Group struct{ net map[string]int64 }

func NewGroup() *Group { return &Group{net: map[string]int64{}} }

func (g *Group) AddExpense(payer string, amount int64, kind string, people []string, values []int64) string {
	var shares []int64
	switch kind {
	case "EQUAL":
		shares = SplitEqual(amount, len(people))
	case "EXACT":
		shares = SplitExact(amount, values)
	default:
		shares = SplitPercent(amount, values)
	}
	if shares == nil {
		return "INVALID"
	}
	g.net[payer] += amount
	out := make([]string, len(people))
	for i, person := range people {
		g.net[person] -= shares[i]
		out[i] = strconv.FormatInt(shares[i], 10)
	}
	return strings.Join(out, " ")
}

func (g *Group) Pay(from, to string, amount int64) string {
	g.net[from] += amount
	g.net[to] -= amount
	return "OK"
}

func (g *Group) Balance(user string) int64 { return g.net[user] }

// Settle 最大债务人付给最大债权人，金额相同按名字 / Largest debtor pays largest creditor; ties by name.
func (g *Group) Settle() string {
	debtors, creditors := &Entries{}, &Entries{}
	for user, v := range g.net {
		if v < 0 {
			*debtors = append(*debtors, Entry{-v, user})
		} else if v > 0 {
			*creditors = append(*creditors, Entry{v, user})
		}
	}
	heap.Init(debtors)
	heap.Init(creditors)
	out := []string{""}
	for debtors.Len() > 0 && creditors.Len() > 0 {
		d := heap.Pop(debtors).(Entry)
		c := heap.Pop(creditors).(Entry)
		pay := d.amount
		if c.amount < pay {
			pay = c.amount
		}
		out = append(out, d.name+" "+c.name+" "+strconv.FormatInt(pay, 10))
		if d.amount > pay {
			heap.Push(debtors, Entry{d.amount - pay, d.name})
		}
		if c.amount > pay {
			heap.Push(creditors, Entry{c.amount - pay, c.name})
		}
	}
	out[0] = strconv.Itoa(len(out) - 1)
	return strings.Join(out, " ")
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
