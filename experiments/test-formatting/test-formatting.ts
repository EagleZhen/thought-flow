// TypeScript formatting test - intentionally messy
export interface CallGraph {
  nodes: string[];
  edges: string[];
}

function messyFunction(x: number, y: number) {
  const result = x + y;
  return result;
}

class MessyClass {
  constructor(public name: string) {}
  greet() {
    console.log('Hello, ' + this.name);
  }
}

const obj = { foo: 'bar', baz: 'qux' };
const arr = [1, 2, 3];
