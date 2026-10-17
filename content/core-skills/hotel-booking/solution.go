package main

import (
	"bufio"
	"os"
	"strconv"
)

const (
	MAX_NIGHTS = 30
	DAYS       = 100000
)

type RoomType struct {
	count         int
	base, weekend int64
	booked        []int // 每晚已订出的间数 / rooms taken per night
}

// WeekendPricing 周五、周六晚用周末价 / Friday and Saturday nights at the weekend rate (day 0 is a Monday).
type WeekendPricing struct{}

func (WeekendPricing) Rate(room *RoomType, night int) int64 {
	if night%7 == 4 || night%7 == 5 {
		return room.weekend
	}
	return room.base
}

type Reservation struct {
	room              *RoomType
	checkIn, checkOut int
	active            bool
}

// Hotel 酒店预订 / Hotel booking: inventory counted per room type and night.
type Hotel struct {
	types        map[string]*RoomType
	pricing      WeekendPricing
	reservations []*Reservation // id - 1 -> reservation
}

func NewHotel(specs map[string][3]int64) *Hotel {
	h := &Hotel{types: map[string]*RoomType{}}
	for name, spec := range specs {
		h.types[name] = &RoomType{count: int(spec[0]), base: spec[1], weekend: spec[2], booked: make([]int, DAYS)}
	}
	return h
}

func (h *Hotel) Book(kind string, checkIn, checkOut int) string {
	if checkOut-checkIn <= 0 || checkOut-checkIn > MAX_NIGHTS {
		return "INVALID"
	}
	room := h.types[kind]
	for d := checkIn; d < checkOut; d++ { // 每一晚都要有空房 / every night must have a room
		if room.booked[d] >= room.count {
			return "FULL"
		}
	}
	price := int64(0)
	for d := checkIn; d < checkOut; d++ {
		room.booked[d]++
		price += h.pricing.Rate(room, d)
	}
	h.reservations = append(h.reservations, &Reservation{room, checkIn, checkOut, true})
	return strconv.Itoa(len(h.reservations)) + " " + strconv.FormatInt(price, 10)
}

func (h *Hotel) Cancel(day int, id int64) string {
	if id < 1 || id > int64(len(h.reservations)) || !h.reservations[id-1].active {
		return "INVALID"
	}
	r := h.reservations[id-1]
	if day >= r.checkIn {
		return "TOO_LATE"
	}
	r.active = false
	for d := r.checkIn; d < r.checkOut; d++ {
		r.room.booked[d]--
	}
	return "OK"
}

func (h *Hotel) Free(kind string, night int) int {
	room := h.types[kind]
	return room.count - room.booked[night]
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
	specs := map[string][3]int64{}
	for t := nextInt(); t > 0; t-- {
		name := next()
		specs[name] = [3]int64{nextInt(), nextInt(), nextInt()}
	}
	hotel := NewHotel(specs)
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "book":
			kind := next()
			checkIn := int(nextInt())
			w.WriteString(hotel.Book(kind, checkIn, int(nextInt())))
		case "cancel":
			day := int(nextInt())
			w.WriteString(hotel.Cancel(day, nextInt()))
		default:
			kind := next()
			w.WriteString(strconv.Itoa(hotel.Free(kind, int(nextInt()))))
		}
		w.WriteByte('\n')
	}
}
