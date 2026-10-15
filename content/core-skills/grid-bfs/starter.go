package main

import (
	"bufio"
	"os"
	"strconv"
)

// ShortestPath 网格 BFS / Fewest 4-directional steps from S to T, or -1.
func ShortestPath(grid []string) int {
	return -1 // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	rows, _ := strconv.Atoi(next())
	next()
	grid := make([]string, rows)
	for r := range grid {
		grid[r] = next()
	}
	os.Stdout.WriteString(strconv.Itoa(ShortestPath(grid)) + "\n")
}
