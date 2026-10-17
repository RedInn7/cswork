package main

import (
	"bufio"
	"os"
	"strconv"
)

// Hotel 酒店预订 / Hotel booking.
// 建议拆出 / Suggested: RoomType（间数、价格、每晚已订出几间 / count, rates, rooms taken per night）,
// Reservation（预订：房型、入住、退房、是否有效 / type, check-in, check-out, active）,
// WeekendPricing（价格规则 / the pricing rule）. 第 0 天是周一 / day 0 is a Monday.
type Hotel struct {
	// TODO
}

// NewHotel specs[name] = {count, base, weekend}.
func NewHotel(specs map[string][3]int64) *Hotel { return &Hotel{} } // TODO

func (h *Hotel) Book(kind string, checkIn, checkOut int) string { return "" } // TODO: "<id> <price>", "FULL", "INVALID"

func (h *Hotel) Cancel(day int, id int64) string { return "" } // TODO: "OK", "TOO_LATE", "INVALID"

func (h *Hotel) Free(kind string, night int) int { return 0 } // TODO: 这一晚该房型的空房数 / free rooms that night

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
