from math_utils import add, mul


def choose_op(a: int, b: int, op: str):
    """Call different functions based on an if/elif/else branch.

    This is useful to test outgoing calls that happen only in certain branches.
    """
    if op == "add":
        return add(a, b)
    elif op == "mul":
        return mul(a, b)
    else:
        # No outgoing call here
        return a - b


def run():
    # Outgoing calls to add/mul originate from choose_op's branches
    x = choose_op(2, 3, "add")
    y = choose_op(4, 5, "mul")
    z = choose_op(10, 1, "unknown")  # else branch, no outgoing call
    return x, y, z

def x():
    return 42


if __name__ == "__main__":
    print(run())
    print(add(5, 7))
    print(mul(5, 7))
