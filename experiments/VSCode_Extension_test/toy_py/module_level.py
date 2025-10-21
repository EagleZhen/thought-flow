# Calls at module import time

def on_import():
    return 42

value = on_import()
