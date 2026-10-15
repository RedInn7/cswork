package main

import (
	"bufio"
	"os"
	"strconv"
)

// PrefixFunction 前缀函数 / pi[i]: longest proper prefix of p[0..i] that is also its suffix.
func PrefixFunction(p string) []int {
	pi := make([]int, len(p))
	for i := 1; i < len(p); i++ {
		j := pi[i-1]
		for j > 0 && p[i] != p[j] {
			j = pi[j-1]
		}
		if p[i] == p[j] {
			j++
		}
		pi[i] = j
	}
	return pi
}

// FindAll KMP 匹配 / Every start index of p in t, overlaps included, in O(|t| + |p|).
func FindAll(t, p string) []int {
	pi, out, j := PrefixFunction(p), []int{}, 0
	for i := 0; i < len(t); i++ {
		for j > 0 && t[i] != p[j] {
			j = pi[j-1]
		}
		if t[i] == p[j] {
			j++
		}
		if j == len(p) {
			out = append(out, i-j+1)
			j = pi[j-1]
		}
	}
	return out
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	t, p := next(), next()
	found := FindAll(t, p)
	for _, row := range [][]int{PrefixFunction(p), {len(found)}, found} {
		if len(row) == 0 {
			w.WriteString("-1")
		}
		for i, v := range row {
			if i > 0 {
				w.WriteByte(' ')
			}
			w.WriteString(strconv.Itoa(v))
		}
		w.WriteByte('\n')
	}
}
