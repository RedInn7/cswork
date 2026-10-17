package main

import (
	"bufio"
	"os"
	"strconv"
)

// LockerStation 快递柜 / Locker station.
// 建议拆出 / Suggested: CodeGenerator（题面里的 LCG / the statement's LCG）, Parcel（包裹、格口、截止时刻 /
// package, compartment, deadline）; 每种尺寸一个空格口堆 / a free-compartment heap per size (container/heap);
// 取件码 -> 包裹的 map / a map from code to parcel. 尺寸 size: 0 = S, 1 = M, 2 = L.
type LockerStation struct {
	// TODO
}

func NewLockerStation(counts [3]int, keep, seed int64) *LockerStation { return &LockerStation{} } // TODO

func (st *LockerStation) Deliver(t int64, pkg string, size int) string { return "" } // TODO: "<compartment> <code>" or "FULL"

func (st *LockerStation) Pickup(t int64, code string) string { return "" } // TODO: "<pkg> <compartment>", "INVALID", "LOCKED"

func (st *LockerStation) Returns(t int64) string { return "" } // TODO: 待退回的包裹 / packages to return, or "NONE"

func (st *LockerStation) Free(t int64, size int) int { return 0 } // TODO: 该尺寸的空格口数 / free compartments of that size

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
