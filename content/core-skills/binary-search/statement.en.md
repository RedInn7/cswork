# Binary Search: lower_bound and upper_bound

Given a **non-decreasing** integer array a (duplicates allowed), write two binary searches by hand:

- `lower_bound(a, x)`: the first index whose element is **at least** x, or n if every element is less than x.
- `upper_bound(a, x)`: the first index whose element is **strictly greater** than x, or n if no element exceeds x.

Their difference is how many times x occurs. Function names follow each language's conventions (Java `lowerBound`, Go `LowerBound`; in C++ `lower_bound_index`, clear of the standard library's name); the starter code has them. No built-in binary search may be called (`bisect`, `std::lower_bound`, `Arrays.binarySearch`, `sort.Search` and so on).

## Input

The first line holds n and q. The second line holds n non-decreasing integers. Each of the next q lines holds one query value x.

1 ≤ n, q ≤ 2×10^4, and every number's absolute value is at most 10^9.

## Output

For each query print one line with two integers: lower_bound and upper_bound (0-based indices).

## Explanation

a = [1, 3, 3, 3, 7, 9]. For 3 the first element ≥ 3 is at index 1 and the first > 3 at index 4, so 3 occurs 4 - 1 = 3 times. 0 is below every element, so both answers are 0; 10 is above every element, so both are 6. 5 is absent, so both answers agree at 4.

## Hints

- Search the half-open range [lo, hi), starting from lo = 0 and hi = n. Loop while lo < hi with mid = lo + (hi - lo) / 2.
- lower_bound: when a[mid] < x the answer lies to the right, so lo = mid + 1; otherwise hi = mid. upper_bound only changes the test to a[mid] <= x.
- When the loop ends lo == hi, and that is the answer. hi starts at n, not n - 1, or the "everything is smaller" case returns the wrong index.
