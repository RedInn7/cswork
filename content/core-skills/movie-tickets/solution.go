package main

import (
	"bufio"
	"os"
	"strconv"
)

const MAX_SEATS = 10

const (
	ACTIVE = iota
	BOOKED
	RELEASED
	EXPIRED
)

type Hold struct {
	user    string
	seats   []int
	expires int64
	status  int
}

// Show 一场电影的座位 / One show's seats: each seat points at the hold that has it, or 0 when free.
type Show struct {
	ttl       int64
	owner     []int   // seat -> hold id, 0: free
	holds     []*Hold // hold id - 1 -> hold
	queue     []*Hold // 按过期时间排好的锁座 / holds in expiry order (one TTL for all)
	freeCount int
}

func NewShow(seats int, ttl int64) *Show {
	return &Show{ttl: ttl, owner: make([]int, seats+1), freeCount: seats}
}

// expire 到期的锁座自动释放 / Release every active hold whose time is up (expires <= t).
func (s *Show) expire(t int64) {
	for len(s.queue) > 0 && s.queue[0].expires <= t {
		hold := s.queue[0]
		s.queue = s.queue[1:]
		if hold.status == ACTIVE {
			hold.status = EXPIRED
			s.freeSeats(hold)
		}
	}
}

func (s *Show) freeSeats(hold *Hold) {
	for _, x := range hold.seats {
		s.owner[x] = 0
	}
	s.freeCount += len(hold.seats)
}

func (s *Show) Hold(t int64, user string, seats []int) string {
	s.expire(t)
	if len(seats) > MAX_SEATS {
		return "TOO_MANY"
	}
	for _, x := range seats { // 全有或全无 / all or nothing
		if s.owner[x] != 0 {
			return "UNAVAILABLE " + strconv.Itoa(x)
		}
	}
	hold := &Hold{user: user, seats: seats, expires: t + s.ttl}
	s.holds = append(s.holds, hold)
	s.queue = append(s.queue, hold)
	for _, x := range seats {
		s.owner[x] = len(s.holds)
	}
	s.freeCount -= len(seats)
	return strconv.Itoa(len(s.holds))
}

func (s *Show) finish(t, id int64, user string, to int) string {
	s.expire(t)
	if id < 1 || id > int64(len(s.holds)) || s.holds[id-1].user != user {
		return "INVALID"
	}
	hold := s.holds[id-1]
	if hold.status == EXPIRED {
		return "EXPIRED"
	}
	if hold.status != ACTIVE {
		return "INVALID"
	}
	hold.status = to
	if to == RELEASED {
		s.freeSeats(hold)
	}
	return "OK"
}

func (s *Show) Confirm(t, id int64, user string) string { return s.finish(t, id, user, BOOKED) }

func (s *Show) Release(t, id int64, user string) string { return s.finish(t, id, user, RELEASED) }

func (s *Show) Free(t int64) int {
	s.expire(t)
	return s.freeCount
}

func (s *Show) Seat(t int64, x int) string {
	s.expire(t)
	if s.owner[x] == 0 {
		return "FREE"
	}
	hold := s.holds[s.owner[x]-1]
	if hold.status == BOOKED {
		return "BOOKED " + hold.user
	}
	return "HELD " + hold.user
}

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
