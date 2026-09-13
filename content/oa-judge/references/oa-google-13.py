def solve(data):
    n,m,target=map(int,data[:3]); pizzas=list(map(int,data[3:3+n])); toppings=list(map(int,data[3+n:])); answer=pizzas[0]
    for pizza in pizzas:
        extras=[0]+toppings+[toppings[i]+toppings[j] for i in range(m) for j in range(i+1,m)]
        for extra in extras:
            cost=pizza+extra
            if (abs(cost-target),cost)<(abs(answer-target),answer):answer=cost
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
