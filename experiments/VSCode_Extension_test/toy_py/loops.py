def sum_for(n):
    total = 0
    for i in range(n):
        total = add_one(total)
    return total


def sum_while(n):
    total = 0
    i = 0
    while i < n:
        total = add_one(total)
        i += 1
    return total


def add_one(x):
    return x + 1
