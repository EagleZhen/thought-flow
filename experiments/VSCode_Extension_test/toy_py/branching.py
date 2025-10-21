def pick_max(a, b):
    """Simple if/else to test outgoing calls found only in one branch"""
    if a > b:
        return helper_branch(a)
    else:
        return helper_branch(b)


def helper_branch(x):
    return x
