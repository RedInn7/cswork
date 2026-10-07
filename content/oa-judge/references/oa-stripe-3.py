def solve(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    cursor = 0
    day_count = int(lines[cursor]); cursor += 1
    batches = []
    for _day in range(day_count):
        count = int(lines[cursor]); cursor += 1
        batch = []
        for line in lines[cursor:cursor + count]:
            merchant, link_type, duration = line.split()
            batch.append((merchant, link_type, int(duration)))
        cursor += count
        batches.append(batch)

    active_records = []
    output = []
    for day, batch in enumerate(batches, 1):
        for merchant, link_type, duration in batch:
            active_records.append((merchant, link_type, day, day + duration))

        # The task describes active same-type links as graph connections.
        # Collapse duplicate merchant/type observations to one membership.
        members_by_type = {}
        for merchant, link_type, added, expires in active_records:
            if added <= day < expires:
                members_by_type.setdefault(link_type, set()).add(merchant)

        graph = {}
        for members in members_by_type.values():
            ordered = sorted(members)
            for merchant in ordered:
                graph.setdefault(merchant, set())
            for i, left in enumerate(ordered):
                for right in ordered[i + 1:]:
                    graph[left].add(right)
                    graph[right].add(left)

        visited = set()
        clusters = []
        for start in sorted(graph):
            if start in visited:
                continue
            stack = [start]
            visited.add(start)
            component = []
            while stack:
                merchant = stack.pop()
                component.append(merchant)
                for neighbor in graph[merchant]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        stack.append(neighbor)
            # Highest unique-neighbor degree; equal degree uses the smallest ID.
            pin = min(component, key=lambda merchant: (-len(graph[merchant]), merchant))
            clusters.append((component, pin))

        clusters.sort(key=lambda item: (-len(item[0]), item[1]))
        output.append(f"Day {day}")
        output.extend(f"  cluster size={len(component)} pin={pin}"
                      for component, pin in clusters)
    return "\n".join(output)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
