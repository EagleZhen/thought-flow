def no_body():
    pass


def calls_builtins():
    print("hello")
    len([1, 2, 3])


def nested_functions():
    def inner():
        return 1
    return inner()


def same_name():
    # Shadowing local function name with variable shouldn't be treated as call
    def helper():
        return 2
    helper_var = 10
    _ = helper_var  # use variable to avoid linter warning
    return helper()
