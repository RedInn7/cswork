import sys

def solve(text):
    data = list(map(int, text.split()))
    n, money = data[0], data[1]
    costs = data[2:2 + n]
    total_cost = sum(costs)

    def spent_for_rounds(rounds):
        return total_cost * rounds * (rounds + 1) // 2

    low, high = 0, 1
    while spent_for_rounds(high) <= money:
        high *= 2
    while low + 1 < high:
        middle = (low + high) // 2
        if spent_for_rounds(middle) <= money:
            low = middle
        else:
            high = middle

    rounds = low
    remaining = money - spent_for_rounds(rounds)
    bought = rounds * n
    next_multiplier = rounds + 1
    for item_cost in costs:
        price = next_multiplier * item_cost
        if price > remaining:
            break
        remaining -= price
        bought += 1
    return str(bought)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
