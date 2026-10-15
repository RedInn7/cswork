package main

import (
	"bufio"
	"os"
	"strconv"
)

type entry struct{ key, value int }

// HashMap 哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75.
type HashMap struct {
	table [][]entry
	size  int
}

func NewHashMap() *HashMap {
	return &HashMap{table: make([][]entry, 8)}
}

// index uses multiplicative hashing, which spreads keys that share low bits.
func index(key, buckets int) int {
	return int(uint32(key) * 2654435761 % uint32(buckets))
}

func (m *HashMap) Put(key, value int) {
	i := index(key, len(m.table))
	for j := range m.table[i] {
		if m.table[i][j].key == key {
			m.table[i][j].value = value
			return
		}
	}
	m.table[i] = append(m.table[i], entry{key, value})
	m.size++
	if m.size*4 > len(m.table)*3 {
		next := make([][]entry, 2*len(m.table))
		for _, chain := range m.table {
			for _, e := range chain {
				j := index(e.key, len(next))
				next[j] = append(next[j], e)
			}
		}
		m.table = next
	}
}

func (m *HashMap) Get(key int) int {
	for _, e := range m.table[index(key, len(m.table))] {
		if e.key == key {
			return e.value
		}
	}
	return -1
}

func (m *HashMap) Remove(key int) bool {
	i := index(key, len(m.table))
	chain := m.table[i]
	for j, e := range chain {
		if e.key == key {
			chain[j] = chain[len(chain)-1]
			m.table[i] = chain[:len(chain)-1]
			m.size--
			return true
		}
	}
	return false
}

func (m *HashMap) Size() int { return m.size }

func (m *HashMap) Buckets() int { return len(m.table) }

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
