package main

import (
	"bufio"
	"container/heap"
	"os"
	"strconv"
)

// IntHeap 小根堆 / a min-heap of spot ids.
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

// SpotAllocator 每种尺寸一个空位小根堆 / one min-heap of free spot ids per size.
type SpotAllocator struct {
	free   [3]*IntHeap
	sizeOf []int // spot id - 1 -> size
}

func NewSpotAllocator(counts [3]int) *SpotAllocator {
	a := &SpotAllocator{}
	id := 1
	for size := 0; size < 3; size++ {
		pool := &IntHeap{}
		for k := 0; k < counts[size]; k++ {
			*pool = append(*pool, id) // ascending: already a heap
			a.sizeOf = append(a.sizeOf, size)
			id++
		}
		a.free[size] = pool
	}
	return a
}

// Allocate 先试刚好合适的尺寸 / smallest size that fits first; -1: none.
func (a *SpotAllocator) Allocate(need int) int {
	for size := need; size < 3; size++ {
		if a.free[size].Len() > 0 {
			return heap.Pop(a.free[size]).(int)
		}
	}
	return -1
}

func (a *SpotAllocator) Release(spot int) { heap.Push(a.free[a.sizeOf[spot-1]], spot) }

type Ticket struct {
	plate string
	spot  int
	entry int64
}

type HourlyPricing struct{ rates [3]int64 }

func (p HourlyPricing) Fee(size int, minutes int64) int64 {
	hours := (minutes + 59) / 60
	if hours < 1 {
		hours = 1
	}
	return hours * p.rates[size]
}

// ParkingLot 停车场 / Parking lot: tickets by id, plates parked, a spot allocator and a pricing rule.
type ParkingLot struct {
	allocator *SpotAllocator
	pricing   HourlyPricing
	active    map[int64]Ticket // ticket id -> ticket
	parked    map[string]bool
	nextID    int64
}

func NewParkingLot(counts, rates [3]int) *ParkingLot {
	p := HourlyPricing{}
	for i, r := range rates {
		p.rates[i] = int64(r)
	}
	return &ParkingLot{allocator: NewSpotAllocator(counts), pricing: p, active: map[int64]Ticket{}, parked: map[string]bool{}, nextID: 1}
}

func (l *ParkingLot) Park(plate string, size int, t int64) string {
	if l.parked[plate] {
		return "DUPLICATE"
	}
	spot := l.allocator.Allocate(size)
	if spot < 0 {
		return "FULL"
	}
	id := l.nextID
	l.nextID++
	l.active[id] = Ticket{plate, spot, t}
	l.parked[plate] = true
	return strconv.FormatInt(id, 10) + " " + strconv.Itoa(spot)
}

func (l *ParkingLot) Unpark(ticketID, t int64) string {
	ticket, ok := l.active[ticketID]
	if !ok {
		return "INVALID"
	}
	delete(l.active, ticketID) // 取出即作废 / used once
	delete(l.parked, ticket.plate)
	l.allocator.Release(ticket.spot)
	return strconv.FormatInt(l.pricing.Fee(l.allocator.sizeOf[ticket.spot-1], t-ticket.entry), 10)
}

func (l *ParkingLot) Available(size int) int { return l.allocator.free[size].Len() }

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
	var counts, rates [3]int
	for i := range counts {
		counts[i] = int(nextInt())
	}
	for i := range rates {
		rates[i] = int(nextInt())
	}
	lot := NewParkingLot(counts, rates)
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "park":
			plate := next()
			size := sizeOf(next())
			w.WriteString(lot.Park(plate, size, nextInt()))
		case "unpark":
			ticket := nextInt()
			w.WriteString(lot.Unpark(ticket, nextInt()))
		default:
			w.WriteString(strconv.Itoa(lot.Available(sizeOf(next()))))
		}
		w.WriteByte('\n')
	}
}
