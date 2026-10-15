package main

import (
	"bufio"
	"os"
	"strconv"
)

// DynamicArray 动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter.
type DynamicArray struct {
	// TODO: 定长存储 make([]int, capacity)（不要 append）加一个长度 / fixed-size storage (no append) plus a length
}

func NewDynamicArray() *DynamicArray {
	return &DynamicArray{} // TODO
}

func (a *DynamicArray) Push(x int) {} // TODO

func (a *DynamicArray) Pop() int { return 0 } // TODO

func (a *DynamicArray) Get(i int) int { return 0 } // TODO

func (a *DynamicArray) Set(i, x int) {} // TODO

func (a *DynamicArray) Insert(i, x int) {} // TODO

func (a *DynamicArray) Erase(i int) int { return 0 } // TODO

func (a *DynamicArray) Size() int { return 0 } // TODO

func (a *DynamicArray) Capacity() int { return 0 } // TODO

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
	arr := NewDynamicArray()
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "push":
			arr.Push(nextInt())
		case "pop":
			put(arr.Pop())
		case "get":
			put(arr.Get(nextInt()))
		case "set":
			i := nextInt()
			arr.Set(i, nextInt())
		case "insert":
			i := nextInt()
			arr.Insert(i, nextInt())
		case "erase":
			put(arr.Erase(nextInt()))
		case "size":
			put(arr.Size())
		default:
			put(arr.Capacity())
		}
	}
}
