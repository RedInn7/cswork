package main

import (
	"bufio"
	"os"
	"strconv"
)

// Prim O(n²) / Nodes (0-based) in the order they join the tree from node 0; fewer than n if disconnected.
func Prim(n int, w [][]int) []int {
	return nil // TODO
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
	n := nextInt()
	g := make([][]int, n)
	for i := range g {
		g[i] = make([]int, n)
		for j := range g[i] {
			g[i][j] = nextInt()
		}
	}
	order := Prim(n, g)
	if len(order) != n {
		w.WriteString("-1\n")
		return
	}
	// Each node joined through its lightest edge to the nodes before it.
	total := 0
	for k := 1; k < n; k++ {
		best := -1
		for j := 0; j < k; j++ {
			if e := g[order[j]][order[k]]; e > 0 && (best < 0 || e < best) {
				best = e
			}
		}
		total += best
	}
	w.WriteString(strconv.Itoa(total) + "\n")
	for k, v := range order {
		if k > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.Itoa(v + 1))
	}
	w.WriteByte('\n')
}
