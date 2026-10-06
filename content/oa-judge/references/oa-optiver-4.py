from array import array
import sys

MASK = (1 << 64) - 1

class LogIndex:
    def __init__(self):
        self.timestamps = array("q", [0])
        self.log_ids = array("q", [0])
        self.sequences = array("q", [0])
        self.priorities = array("Q", [MASK])
        self.left = array("i", [0])
        self.right = array("i", [0])
        self.sizes = array("i", [0])
        self.root = 0
        self.maximum_timestamp = None
        self.sequence = 0

    def _size(self, node):
        return self.sizes[node] if node else 0

    def _pull(self, node):
        self.sizes[node] = 1 + self._size(self.left[node]) + self._size(self.right[node])

    def _priority(self, value):
        # SplitMix64 gives deterministic, well-distributed treap priorities.
        z = (value + 0x9E3779B97F4A7C15) & MASK
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return z ^ (z >> 31)

    def _rotate_right(self, node):
        child = self.left[node]
        self.left[node] = self.right[child]
        self.right[child] = node
        self._pull(node)
        self._pull(child)
        return child

    def _rotate_left(self, node):
        child = self.right[node]
        self.right[node] = self.left[child]
        self.left[child] = node
        self._pull(node)
        self._pull(child)
        return child

    def _key_less(self, a, b):
        return (self.timestamps[a], self.sequences[a]) < (self.timestamps[b], self.sequences[b])

    def _insert(self, root, node):
        if not root:
            return node
        if self._key_less(node, root):
            self.left[root] = self._insert(self.left[root], node)
            if self.priorities[self.left[root]] < self.priorities[root]:
                root = self._rotate_right(root)
        else:
            self.right[root] = self._insert(self.right[root], node)
            if self.priorities[self.right[root]] < self.priorities[root]:
                root = self._rotate_left(root)
        self._pull(root)
        return root

    def add(self, log_id, timestamp):
        self.sequence += 1
        seq = self.sequence
        self.timestamps.append(timestamp)
        self.log_ids.append(log_id)
        self.sequences.append(seq)
        self.priorities.append(self._priority(seq))
        self.left.append(0)
        self.right.append(0)
        self.sizes.append(1)
        self.root = self._insert(self.root, seq)
        if self.maximum_timestamp is None or timestamp > self.maximum_timestamp:
            self.maximum_timestamp = timestamp

    def _rank_less(self, timestamp, sequence):
        """Number of keys strictly less than (timestamp, sequence)."""
        node = self.root
        count = 0
        while node:
            if (self.timestamps[node], self.sequences[node]) < (timestamp, sequence):
                count += self._size(self.left[node]) + 1
                node = self.right[node]
            else:
                node = self.left[node]
        return count

    def _collect(self, node, first, last, base, result):
        if not node or first >= last:
            return
        left_size = self._size(self.left[node])
        position = base + left_size
        if first < position:
            self._collect(self.left[node], first, min(last, position), base, result)
        if first <= position < last:
            result.append(node)
        if last > position + 1:
            self._collect(self.right[node], max(first, position + 1), last, position + 1, result)

    def window_bounds(self):
        if self.maximum_timestamp is None:
            return 0, 0
        cutoff = self.maximum_timestamp - 3600
        left = self._rank_less(cutoff + 1, 0)  # exclude timestamps <= cutoff
        right = self._rank_less(self.maximum_timestamp + 1, 0)
        return left, right

    def get_logs(self, limit):
        left, right = self.window_bounds()
        first = max(left, right - limit)
        selected = []
        self._collect(self.root, first, right, 0, selected)
        return ",".join(str(self.log_ids[node]) for node in selected)

    def get_count(self):
        left, right = self.window_bounds()
        return right - left

def solve_stream(stream, output):
    first = stream.readline().split()
    if len(first) != 2:
        raise ValueError("expected m q header")
    limit, operation_count = map(int, first)
    if not 1 <= limit <= 1000 or not 1 <= operation_count <= 1000000:
        raise ValueError("header outside stated constraints")
    index = LogIndex()
    for _ in range(operation_count):
        parts = stream.readline().split()
        if not parts:
            raise ValueError("missing operation")
        if parts[0] == b"RECORD" and len(parts) == 3:
            log_id, timestamp = map(int, parts[1:])
            if not -1000000000 <= log_id <= 1000000000 or not -1000000000000 <= timestamp <= 1000000000000:
                raise ValueError("value outside site input supplement")
            index.add(log_id, timestamp)
        elif parts[0] == b"GET_LOGS" and len(parts) == 1:
            output.write(index.get_logs(limit) + "\n")
        elif parts[0] == b"COUNT" and len(parts) == 1:
            output.write(str(index.get_count()) + "\n")
        else:
            raise ValueError("invalid operation")

if __name__ == "__main__":
    solve_stream(sys.stdin.buffer, sys.stdout)
