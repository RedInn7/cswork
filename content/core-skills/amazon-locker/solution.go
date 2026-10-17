package main

import (
	"bufio"
	"container/heap"
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	MAX_FAILURES = 5
	LOCKOUT      = 30
)

// CodeGenerator 取件码生成器 / Pickup codes from a fixed LCG, so the judge can replay them (production: a CSPRNG).
type CodeGenerator struct{ x int64 }

func (g *CodeGenerator) Next() string {
	g.x = (g.x*1103515245 + 12345) % 2147483648
	return fmt.Sprintf("%06d", g.x%1000000)
}

// IntHeap 小根堆 / a min-heap of compartment ids.
type IntHeap []int

func (h IntHeap) Len() int            { return len(h) }
func (h IntHeap) Less(i, j int) bool  { return h[i] < h[j] }
func (h IntHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *IntHeap) Push(x interface{}) { *h = append(*h, x.(int)) }
func (h *IntHeap) Pop() interface{} {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

type Parcel struct {
	pkg         string
	compartment int
	deadline    int64
}

type queued struct {
	code   string
	parcel *Parcel
}

// LockerStation 快递柜 / Locker station: free compartments by size, parcels by code, expiry and a keypad lockout.
type LockerStation struct {
	keep        int64
	codes       *CodeGenerator
	freeBySize  [3]*IntHeap
	sizeOf      []int              // compartment - 1 -> size
	byCode      map[string]*Parcel // 有效的取件码 -> 包裹 / active code -> parcel
	queue       []queued           // 按投递顺序 / in delivery order: also expiry order
	returned    []string           // 超期待退回 / expired, waiting for the returns courier
	failures    int
	lockedUntil int64
}

func NewLockerStation(counts [3]int, keep, seed int64) *LockerStation {
	st := &LockerStation{keep: keep, codes: &CodeGenerator{seed}, byCode: map[string]*Parcel{}, lockedUntil: -1}
	id := 1
	for size := 0; size < 3; size++ {
		pool := &IntHeap{}
		for k := 0; k < counts[size]; k++ {
			*pool = append(*pool, id) // ascending: already a heap
			st.sizeOf = append(st.sizeOf, size)
			id++
		}
		st.freeBySize[size] = pool
	}
	return st
}

func (st *LockerStation) expire(t int64) {
	for len(st.queue) > 0 && st.queue[0].parcel.deadline <= t {
		head := st.queue[0]
		st.queue = st.queue[1:]
		if st.byCode[head.code] == head.parcel { // 还没被取走 / not picked up yet
			delete(st.byCode, head.code)
			st.release(head.parcel.compartment)
			st.returned = append(st.returned, head.parcel.pkg)
		}
	}
}

func (st *LockerStation) release(compartment int) {
	heap.Push(st.freeBySize[st.sizeOf[compartment-1]], compartment)
}

func (st *LockerStation) Deliver(t int64, pkg string, size int) string {
	st.expire(t)
	compartment := -1
	for s := size; s < 3 && compartment < 0; s++ { // 能装下的最小尺寸 / the smallest size that fits
		if st.freeBySize[s].Len() > 0 {
			compartment = heap.Pop(st.freeBySize[s]).(int)
		}
	}
	if compartment < 0 {
		return "FULL"
	}
	code := st.codes.Next()
	for st.byCode[code] != nil { // 和有效的码重复就重抽 / never reuse an active code
		code = st.codes.Next()
	}
	parcel := &Parcel{pkg, compartment, t + st.keep}
	st.byCode[code] = parcel
	st.queue = append(st.queue, queued{code, parcel})
	return strconv.Itoa(compartment) + " " + code
}

func (st *LockerStation) Pickup(t int64, code string) string {
	st.expire(t)
	if t < st.lockedUntil {
		return "LOCKED"
	}
	parcel := st.byCode[code]
	if parcel == nil {
		st.failures++
		if st.failures == MAX_FAILURES { // 连续输错：锁键盘 / too many wrong codes: lock the keypad
			st.failures, st.lockedUntil = 0, t+LOCKOUT
		}
		return "INVALID"
	}
	delete(st.byCode, code)
	st.failures = 0
	st.release(parcel.compartment)
	return parcel.pkg + " " + strconv.Itoa(parcel.compartment)
}

func (st *LockerStation) Returns(t int64) string {
	st.expire(t)
	out := strings.Join(st.returned, " ")
	st.returned = nil
	if out == "" {
		return "NONE"
	}
	return out
}

func (st *LockerStation) Free(t int64, size int) int {
	st.expire(t)
	return st.freeBySize[size].Len()
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int64 { v, _ := strconv.ParseInt(next(), 10, 64); return v }
	sizeOf := func(s string) int { return map[string]int{"S": 0, "M": 1, "L": 2}[s] }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	var counts [3]int
	for i := range counts {
		counts[i] = int(nextInt())
	}
	keep := nextInt()
	station := NewLockerStation(counts, keep, nextInt())
	for q := nextInt(); q > 0; q-- {
		op := next()
		t := nextInt()
		switch op {
		case "deliver":
			pkg := next()
			w.WriteString(station.Deliver(t, pkg, sizeOf(next())))
		case "pickup":
			w.WriteString(station.Pickup(t, next()))
		case "returns":
			w.WriteString(station.Returns(t))
		default:
			w.WriteString(strconv.Itoa(station.Free(t, sizeOf(next()))))
		}
		w.WriteByte('\n')
	}
}
