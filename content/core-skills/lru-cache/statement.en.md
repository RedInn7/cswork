# LRU Cache

Implement an LRU (least recently used) cache `LRUCache` holding up to capacity keys. Every `get` hit and every `put` makes its key the most recently used; when a new key does not fit, evict the key unused for the longest time.

Both `get` and `put` must be O(1): a hash map finds a key's node, and a **doubly linked list you write yourself** chains every node by use (most recent at the head, oldest at the tail), so moving or removing a node only relinks pointers. Built-in hash maps are fine (`dict`, `unordered_map`, `HashMap`, Go's `map`); built-in ordered containers are not (`OrderedDict`, `LinkedHashMap`).

Methods to implement:

| Method | Does |
| --- | --- |
| `get(key)` | Return the value and mark the key most recent; -1 if absent |
| `put(key, value)` | Insert or update and mark the key most recent; if that exceeds the capacity, evict the least recently used key and return it, otherwise return -1 |
| `keys()` | Every key from most to least recent, for the driver to print |

## Input

The first line holds the capacity and the number of operations q. Each of the next q lines is one operation:

get k / put k v / order

1 ≤ capacity ≤ 10^4, 1 ≤ q ≤ 2×10^4, 0 ≤ k, v ≤ 10^9. The orders print at most 5×10^4 keys in total.

## Output

`get` prints the value or -1; `put` prints the evicted key, or -1 if nothing was evicted; `order` prints every key from most to least recent on one line, separated by spaces, or empty for an empty cache.

## Explanation

The capacity is 2. After put 1 and put 2 the order is 2 1. get 1 hits and makes 1 the most recent: 1 2. put 3 does not fit and evicts the oldest, 2, so get 2 gives -1. put 1 10 only updates key 1 and moves it to the front, evicting nothing. put 4 evicts 3, now the oldest.

## Hints

- With a sentinel node at each end of the list, insertion and removal never check for a missing neighbour.
- Updating an existing key leaves the size unchanged and must not evict anything.
- An eviction removes the key from both the list and the hash map, so each node stores its key too.
