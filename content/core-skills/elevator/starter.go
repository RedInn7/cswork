package main

import (
	"bufio"
	"os"
	"strconv"
)

// Elevator 电梯 / Elevator: one car.
// 建议用两个楼层集合 / Suggested: two sets of floors, upStops（上行时停 / stop while going up）
// and downStops（下行时停 / stop while going down）. 方向 / directions: "UP", "DOWN", "IDLE".
type Elevator struct {
	// TODO
}

func NewElevator(floors, start int) *Elevator {
	return &Elevator{} // TODO
}

func (e *Elevator) Call(f int, want string) string { return "" } // TODO: 厅外按钮 / a hall call ("UP" / "DOWN"): "OK"

func (e *Elevator) Press(f int) string { return "" } // TODO: 轿厢内按钮 / a car button: "OK", or "OPEN" at this floor

func (e *Elevator) Step() string { return "" } // TODO: "<floor> <dir> OPEN" or "<floor> <dir> -"

func (e *Elevator) Where() string { return "" } // TODO: "<floor> <dir> <pending stops>"

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
