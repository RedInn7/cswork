from array import array
import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        return ""
    n, k = values[0], values[1]
    if n < 1 or not 0 <= k < n:
        raise ValueError("require n >= 1 and 0 <= k < n")
    if len(values) != 2 + 2 * (n - 1):
        raise ValueError("expected n-1 edges")
    required = n - k
    graph = [[] for _ in range(n)]
    cursor = 2
    for _ in range(n - 1):
        a, b = values[cursor] - 1, values[cursor + 1] - 1
        cursor += 2
        if not (0 <= a < n and 0 <= b < n) or a == b:
            raise ValueError("invalid tree edge")
        graph[a].append(b)
        graph[b].append(a)

    # Rooting and Euler intervals support subtree-by-depth counting.
    parent = [-2] * n
    depth = [0] * n
    entry = [0] * n
    exit_ = [0] * n
    preorder = []
    parent[0] = -1
    todo = [(0, False)]
    while todo:
        node, leaving = todo.pop()
        if leaving:
            exit_[node] = len(preorder)
            continue
        entry[node] = len(preorder)
        preorder.append(node)
        todo.append((node, True))
        for child in reversed(graph[node]):
            if child == parent[node]:
                continue
            if parent[child] != -2:
                raise ValueError("input graph is not a tree")
            parent[child] = node
            depth[child] = depth[node] + 1
            todo.append((child, False))
    if len(preorder) != n:
        raise ValueError("input tree is disconnected")

    # Persistent prefix histograms over Euler positions, keyed by depth.
    roots = array("i", [0])
    left = array("i", [0])
    right = array("i", [0])
    count = array("i", [0])
    for vertex in preorder:
        previous = roots[-1]
        root = len(count)
        left.append(left[previous])
        right.append(right[previous])
        count.append(count[previous] + 1)
        old_node, new_node = previous, root
        low, high, value = 0, n - 1, depth[vertex]
        while low < high:
            middle = (low + high) >> 1
            if value <= middle:
                old_child = left[old_node]
                new_child = len(count)
                left.append(left[old_child])
                right.append(right[old_child])
                count.append(count[old_child] + 1)
                left[new_node] = new_child
                old_node, new_node, high = old_child, new_child, middle
            else:
                old_child = right[old_node]
                new_child = len(count)
                left.append(left[old_child])
                right.append(right[old_child])
                count.append(count[old_child] + 1)
                right[new_node] = new_child
                old_node, new_node, low = old_child, new_child, middle + 1
        roots.append(root)

    def subtree_count_by_depth(vertex, radius):
        if radius < 0:
            return 0
        limit = depth[vertex] + radius
        if limit >= n - 1:
            return exit_[vertex] - entry[vertex]
        right_root = roots[exit_[vertex]]
        left_root = roots[entry[vertex]]
        low, high, result = 0, n - 1, 0
        while low < high:
            middle = (low + high) >> 1
            if limit <= middle:
                right_root = left[right_root]
                left_root = left[left_root]
                high = middle
            else:
                result += count[left[right_root]] - count[left[left_root]]
                right_root = right[right_root]
                left_root = right[left_root]
                low = middle + 1
        if low <= limit:
            result += count[right_root] - count[left_root]
        return result

    # Centroid ancestor paths; three compact arrays per vertex avoid storing
    # millions of Python tuple objects at n=100000.
    centroids = [array("i") for _ in range(n)]
    distances = [array("i") for _ in range(n)]
    branches = [array("i") for _ in range(n)]
    removed = bytearray(n)
    scratch_parent = [-2] * n
    subtree_size = [0] * n
    whole_histogram = [None] * n
    branch_histograms = [None] * n
    pending = [0]

    while pending:
        seed = pending.pop()
        if removed[seed]:
            continue
        component = []
        walk = [(seed, -1)]
        while walk:
            u, p = walk.pop()
            scratch_parent[u] = p
            component.append(u)
            for v in graph[u]:
                if not removed[v] and v != p:
                    walk.append((v, u))
        component_size = len(component)
        for u in reversed(component):
            size = 1
            for v in graph[u]:
                if not removed[v] and scratch_parent[v] == u:
                    size += subtree_size[v]
            subtree_size[u] = size
        center = seed
        for u in component:
            largest_part = component_size - subtree_size[u]
            for v in graph[u]:
                if (not removed[v] and scratch_parent[v] == u
                        and subtree_size[v] > largest_part):
                    largest_part = subtree_size[v]
            if largest_part <= component_size // 2:
                center = u
                break

        removed[center] = 1
        centroids[center].append(center)
        distances[center].append(0)
        branches[center].append(-1)
        all_frequency = [1]
        child_histograms = {}
        for neighbor in graph[center]:
            if removed[neighbor]:
                continue
            pending.append(neighbor)
            branch_distances = []
            walk = [(neighbor, center, 1)]
            while walk:
                u, p, d = walk.pop()
                centroids[u].append(center)
                distances[u].append(d)
                branches[u].append(neighbor)
                branch_distances.append(d)
                if len(all_frequency) <= d:
                    all_frequency.extend([0] * (d + 1 - len(all_frequency)))
                all_frequency[d] += 1
                for v in graph[u]:
                    if v != p and not removed[v]:
                        walk.append((v, u, d + 1))
            local_frequency = [0] * (max(branch_distances) + 1)
            for d in branch_distances:
                local_frequency[d] += 1
            subtotal = 0
            for i, amount in enumerate(local_frequency):
                subtotal += amount
                local_frequency[i] = subtotal
            child_histograms[neighbor] = array("i", local_frequency)
        subtotal = 0
        for i, amount in enumerate(all_frequency):
            subtotal += amount
            all_frequency[i] = subtotal
        whole_histogram[center] = array("i", all_frequency)
        branch_histograms[center] = child_histograms

    def ball_size(vertex, radius):
        answer = 0
        chain_c = centroids[vertex]
        chain_d = distances[vertex]
        chain_b = branches[vertex]
        for i in range(len(chain_c)):
            remaining = radius - chain_d[i]
            if remaining < 0:
                continue
            center = chain_c[i]
            hist = whole_histogram[center]
            answer += hist[remaining] if remaining < len(hist) else hist[-1]
            branch = chain_b[i]
            if branch >= 0:
                hist = branch_histograms[center][branch]
                answer -= hist[remaining] if remaining < len(hist) else hist[-1]
        return answer

    # Any retained connected subtree has at least `required` vertices, so its
    # diameter is at most required-1. This is a known-feasible binary-search
    # bound and avoids testing diameters that cannot improve the answer.
    lower, upper = 0, required - 1
    while lower < upper:
        limit = (lower + upper) // 2
        radius = limit // 2
        balls = [0] * n
        enough = False
        for vertex in range(n):
            balls[vertex] = ball_size(vertex, radius)
            if balls[vertex] >= required:
                enough = True
                break
        if not enough and limit % 2:
            # Edge-centred radius-r balls: parent side plus child side.
            for child in range(1, n):
                p = parent[child]
                size = balls[p] - subtree_count_by_depth(child, radius - 1)
                size += subtree_count_by_depth(child, radius)
                if size >= required:
                    enough = True
                    break
        if enough:
            upper = limit
        else:
            lower = limit + 1
    return str(lower)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
