package main

import (
	"bufio"
	"os"
	"strconv"
)

// Elevator 电梯 / Elevator: one car, LOOK scheduling over two sets of stops.
type Elevator struct {
	floor     int
	dir       string
	upStops   map[int]bool // 上行时要停的楼层 / floors to stop at while going up
	downStops map[int]bool // 下行时要停的楼层 / floors to stop at while going down
}

func NewElevator(floors, start int) *Elevator {
	return &Elevator{floor: start, dir: "IDLE", upStops: map[int]bool{}, downStops: map[int]bool{}}
}

func (e *Elevator) Call(f int, want string) string {
	if want == "UP" {
		e.upStops[f] = true
	} else {
		e.downStops[f] = true
	}
	return "OK"
}

func (e *Elevator) Press(f int) string {
	if f > e.floor {
		e.upStops[f] = true
	} else if f < e.floor {
		e.downStops[f] = true
	} else {
		return "OPEN"
	}
	return "OK"
}

// ponytail: scans the pending stops, O(stops) per check; at most 200 floors here.
func (e *Elevator) work(above bool) bool {
	for _, stops := range []map[int]bool{e.upStops, e.downStops} {
		for f := range stops {
			if (above && f > e.floor) || (!above && f < e.floor) {
				return true
			}
		}
	}
	return false
}

func take(stops map[int]bool, f int) bool {
	if stops[f] {
		delete(stops, f)
		return true
	}
	return false
}

func (e *Elevator) Step() string {
	if e.dir == "UP" && !e.work(true) {
		e.dir = "IDLE"
		if e.work(false) {
			e.dir = "DOWN"
		}
	} else if e.dir == "DOWN" && !e.work(false) {
		e.dir = "IDLE"
		if e.work(true) {
			e.dir = "UP"
		}
	} else if e.dir == "IDLE" {
		if e.work(true) {
			e.dir = "UP"
		} else if e.work(false) {
			e.dir = "DOWN"
		}
	}
	ahead := e.downStops
	if e.dir == "UP" {
		ahead = e.upStops
	}
	var stop bool
	if e.dir == "IDLE" { // 别处没有任务：服务本层 / nothing elsewhere: serve this floor
		a := take(e.upStops, e.floor)
		b := take(e.downStops, e.floor)
		stop = a || b
	} else if take(ahead, e.floor) {
		stop = true // 本层有同方向的请求：开门，这一步不动 / a call here this way: open, stay
	} else if e.dir == "UP" {
		e.floor++
		stop = take(e.upStops, e.floor)
		if !e.work(true) && take(e.downStops, e.floor) { // 本趟的最高点 / top of the sweep
			stop = true
		}
	} else {
		e.floor--
		stop = take(e.downStops, e.floor)
		if !e.work(false) && take(e.upStops, e.floor) {
			stop = true
		}
	}
	event := " -"
	if stop {
		event = " OPEN"
	}
	return strconv.Itoa(e.floor) + " " + e.dir + event
}

func (e *Elevator) Where() string {
	return strconv.Itoa(e.floor) + " " + e.dir + " " + strconv.Itoa(len(e.upStops)+len(e.downStops))
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	floors := nextInt()
	car := NewElevator(floors, nextInt())
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "call":
			f := nextInt()
			want := "DOWN"
			if next() == "U" {
				want = "UP"
			}
			w.WriteString(car.Call(f, want))
		case "press":
			w.WriteString(car.Press(nextInt()))
		case "step":
			w.WriteString(car.Step())
		default:
			w.WriteString(car.Where())
		}
		w.WriteByte('\n')
	}
}
