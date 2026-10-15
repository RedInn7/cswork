package main

import (
	"bufio"
	"math"
	"os"
	"strconv"
)

// Prim O(n²) / Nodes (0-based) in the order they join the tree from node 0; fewer than n if disconnected.
func Prim(n int, w [][]int) []int {
	key, inTree, order := make([]int, n), make([]bool, n), []int{}
	for v := range key {
		key[v] = math.MaxInt
	}
	key[0] = 0
	for step := 0; step < n; step++ {
		u := -1
		for v := 0; v < n; v++ {
			if !inTree[v] && key[v] < math.MaxInt && (u < 0 || key[v] < key[u]) {
				u = v
			}
		}
		if u < 0 {
			break
		}
		inTree[u] = true
		order = append(order, u)
		for v := 0; v < n; v++ {
			if !inTree[v] && w[u][v] > 0 && w[u][v] < key[v] {
				key[v] = w[u][v]
			}
		}
	}
	return order
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
