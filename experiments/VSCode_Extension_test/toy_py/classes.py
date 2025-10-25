class Greeter:
    def __init__(self, name: str):
        self.name = name

    def greet(self):
        return self._format()

    def _format(self):
        return f"Hello, {self.name}!"


def use_greeter():
    g = Greeter("World")
    return g.greet()
