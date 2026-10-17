package main

import (
	"bufio"
	"os"
	"strconv"
)

// Show 一场电影的座位 / One show's seats.
// 建议拆出 / Suggested: Hold（锁座：用户、座位、过期时刻、状态 / user, seats, expiry, status）;
// 每个座位记住占着它的锁座 / each seat remembers the hold that has it; 到期的锁座在每个操作开始时释放
// / release expired holds at the start of every operation.
type Show struct {
	// TODO
}

// NewShow 座位编号 1..seats / seats 1..seats; holds expire ttl after they are made.
func NewShow(seats int, ttl int64) *Show { return &Show{} } // TODO

func (s *Show) Hold(t int64, user string, seats []int) string { return "" } // TODO: id, "TOO_MANY", "UNAVAILABLE <seat>"

func (s *Show) Confirm(t, id int64, user string) string { return "" } // TODO: "OK", "EXPIRED", "INVALID"

func (s *Show) Release(t, id int64, user string) string { return "" } // TODO: "OK", "EXPIRED", "INVALID"

func (s *Show) Free(t int64) int { return 0 } // TODO: 空座数 / free seats

func (s *Show) Seat(t int64, x int) string { return "" } // TODO: "FREE", "HELD <user>", "BOOKED <user>"

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int64 { v, _ := strconv.ParseInt(next(), 10, 64); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	seats := int(nextInt())
	show := NewShow(seats, nextInt())
	for q := nextInt(); q > 0; q-- {
		op := next()
		t := nextInt()
		switch op {
		case "hold":
			user := next()
			chosen := make([]int, nextInt())
			for i := range chosen {
				chosen[i] = int(nextInt())
			}
			w.WriteString(show.Hold(t, user, chosen))
		case "confirm", "release":
			id := nextInt()
			user := next()
			if op == "confirm" {
				w.WriteString(show.Confirm(t, id, user))
			} else {
				w.WriteString(show.Release(t, id, user))
			}
		case "free":
			w.WriteString(strconv.Itoa(show.Free(t)))
		default:
			w.WriteString(show.Seat(t, int(nextInt())))
		}
		w.WriteByte('\n')
	}
}
