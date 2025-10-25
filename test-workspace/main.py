from calculator.core import factorial
from calculator.utils import add


def main():
    sum = add(2, 3)
    fact = factorial(sum)
    print(f"{sum}! = {fact}")


if __name__ == "__main__":
    main()
