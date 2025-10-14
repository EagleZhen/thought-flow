from math_utils import add, mul


def run():
    # Incoming calls to add and mul originate from here
    x = add(2, 3)
    y = mul(4, 5)
    return x, y


if __name__ == "__main__":
    print(run())
