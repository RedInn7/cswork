package main

import (
	"bufio"
	"os"
	"strconv"
)

// ParkingLot 停车场 / Parking lot.
// 建议拆出 / Suggested types: SpotAllocator（每种尺寸一个空位堆 / a free-spot heap per size, container/heap）,
// Ticket, HourlyPricing（计费策略 / the pricing strategy）. 尺寸 size: 0 = S, 1 = M, 2 = L.
type ParkingLot struct {
	// TODO
}

// NewParkingLot counts[size]: 该尺寸车位数 / spots of that size; rates[size]: 每小时价格 / price per hour.
func NewParkingLot(counts, rates [3]int) *ParkingLot {
	return &ParkingLot{} // TODO
}

func (l *ParkingLot) Park(plate string, size int, t int64) string { return "" } // TODO: "<ticket> <spot>", "FULL", "DUPLICATE"

func (l *ParkingLot) Unpark(ticketID, t int64) string { return "" } // TODO: 停车费 / the fee, or "INVALID"

func (l *ParkingLot) Available(size int) int { return 0 } // TODO: 该尺寸的空位数 / free spots of exactly that size

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
