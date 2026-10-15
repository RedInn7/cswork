package main

import (
	"bufio"
	"os"
	"strconv"
)

// ShortestPath 网格 BFS / Fewest 4-directional steps from S to T, or -1.
func ShortestPath(grid []string) int {
	rows, cols := len(grid), len(grid[0])
	dist := make([]int, rows*cols)
	queue := []int{}
	for i := range dist {
		dist[i] = -1
		if grid[i/cols][i%cols] == 'S' {
			dist[i] = 0
			queue = append(queue, i)
		}
	}
	dr, dc := []int{1, -1, 0, 0}, []int{0, 0, 1, -1}
	for head := 0; head < len(queue); head++ {
		cell := queue[head]
		r, c := cell/cols, cell%cols
		if grid[r][c] == 'T' {
			return dist[cell]
		}
		for d := 0; d < 4; d++ {
			nr, nc := r+dr[d], c+dc[d]
			if nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] == '#' || dist[nr*cols+nc] >= 0 {
				continue
			}
			dist[nr*cols+nc] = dist[cell] + 1
			queue = append(queue, nr*cols+nc)
		}
	}
	return -1
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
