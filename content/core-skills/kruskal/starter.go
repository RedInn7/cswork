package main

import (
	"bufio"
	"os"
	"strconv"
)

// Kruskal / Indices of the chosen edges in the order chosen; fewer than n - 1 if disconnected.
// 排序可以用 sort.SliceStable（记得在 import 里加上 "sort"） / sort.SliceStable works (add "sort" to the imports).
func Kruskal(n int, edges [][3]int) []int {
	return nil // TODO: 排序 + 并查集 / sort + union-find
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
	n, m := nextInt(), nextInt()
	edges := make([][3]int, m)
	for i := range edges {
		edges[i] = [3]int{nextInt(), nextInt(), nextInt()}
	}
	chosen := Kruskal(n, edges)
	if len(chosen) != n-1 {
		w.WriteString("-1\n")
		return
	}
	total := 0
	for _, i := range chosen {
		total += edges[i][2]
	}
	w.WriteString(strconv.Itoa(total) + "\n")
	for k, i := range chosen {
		if k > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.Itoa(i + 1))
	}
	w.WriteByte('\n')
}
