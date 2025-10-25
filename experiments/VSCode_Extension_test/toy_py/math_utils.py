def helper(x):
    """Double a value; used by add/mul to show outgoing relations."""
    return x * 2


def add(a, b):
    """Add two numbers and post-process via helper."""
    total = a + b
    # Outgoing call to helper
    return helper(total)


def mul(a, b):
    """Multiply two numbers and post-process via helper."""
    product = a * b
    # Outgoing call to helper
    return helper(product)
