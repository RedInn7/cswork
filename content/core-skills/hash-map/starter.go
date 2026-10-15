package main

import (
	"bufio"
	"os"
	"strconv"
)

type entry struct{ key, value int }

// HashMap 哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75.
type HashMap struct {
	table [][]entry // 每个桶一串 entry / each bucket chains entries
	size  int
}

func NewHashMap() *HashMap {
	return &HashMap{table: make([][]entry, 8)}
}

func (m *HashMap) Put(key, value int) {} // TODO

func (m *HashMap) Get(key int) int { return -1 } // TODO

func (m *HashMap) Remove(key int) bool { return false } // TODO

func (m *HashMap) Size() int { return 0 } // TODO

func (m *HashMap) Buckets() int { return 0 } // TODO

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	put := func(v int) { w.WriteString(strconv.Itoa(v)); w.WriteByte('\n') }
	table := NewHashMap()
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "put":
			k := nextInt()
			table.Put(k, nextInt())
		case "get":
			put(table.Get(nextInt()))
		case "remove":
			if table.Remove(nextInt()) {
				put(1)
			} else {
				put(0)
			}
		case "size":
			put(table.Size())
		default:
			put(table.Buckets())
		}
	}
}
