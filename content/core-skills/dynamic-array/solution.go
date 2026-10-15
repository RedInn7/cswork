package main

import (
	"bufio"
	"os"
	"strconv"
)

// DynamicArray 动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter.
type DynamicArray struct {
	data []int // fixed length: replaced, never appended to
	size int
}

func NewDynamicArray() *DynamicArray {
	return &DynamicArray{data: make([]int, 1)}
}

func (a *DynamicArray) resize(capacity int) {
	data := make([]int, capacity)
	for i := 0; i < a.size; i++ {
		data[i] = a.data[i]
	}
	a.data = data
}

func (a *DynamicArray) Push(x int) { a.Insert(a.size, x) }

func (a *DynamicArray) Pop() int { return a.Erase(a.size - 1) }

func (a *DynamicArray) Get(i int) int { return a.data[i] }

func (a *DynamicArray) Set(i, x int) { a.data[i] = x }

func (a *DynamicArray) Insert(i, x int) {
	if a.size == len(a.data) {
		a.resize(2 * len(a.data))
	}
	for j := a.size; j > i; j-- {
		a.data[j] = a.data[j-1]
	}
	a.data[i] = x
	a.size++
}

func (a *DynamicArray) Erase(i int) int {
	x := a.data[i]
	for j := i; j+1 < a.size; j++ {
		a.data[j] = a.data[j+1]
	}
	a.size--
	if len(a.data) > 1 && a.size*4 <= len(a.data) {
		a.resize(len(a.data) / 2)
	}
	return x
}

func (a *DynamicArray) Size() int { return a.size }

func (a *DynamicArray) Capacity() int { return len(a.data) }

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
