def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


def mutual_a(n):
    if n <= 0:
        return 0
    return 1 + mutual_b(n - 1)


def mutual_b(n):
    if n <= 0:
        return 0
    return 1 + mutual_a(n - 1)
