from .utils import multiply


def factorial(n):
    if n <= 1:
        return 1
    return multiply(n, factorial(n - 1))
