# Python formatting test - intentionally messy
import os
import sys
from typing import Dict, List


def messy_function(x, y):
    result = x + y
    return result


class MessyClass:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_info(self):
        return f"{self.name} is {self.age}"


if __name__ == "__main__":
    obj = MessyClass("Alice", 30)
    print(obj.get_info())
    unused_var = 42
    unused_var = 42
