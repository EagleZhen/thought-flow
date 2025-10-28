import * as types from './types'; // Imports the named export

const baseNode: types.FunctionCall = {
    name: "run",
    filePath: "toy_py/app.py",
    line: 4
};

const in1: types.FunctionCall = {
    name: "run",
    filePath: "toy_py/app.py",
    line: 4
} ;
const in2: types.FunctionCall = {
    name: "run",
    filePath: "toy_py/app.py",
    line: 12
};
const out1: types.FunctionCall = {
    name: "add",
    filePath: "toy_py/app.py",
    line: 6
};
const out2: types.FunctionCall = {
    name: "mul",
    filePath: "toy_py/app.py",
    line: 7
};

const sampleInput: types.CallHierarchy = {
    target: baseNode,

    /** Incoming calls (functions that call the target) */
    incoming: [in1,in2],

    /** Outgoing calls (functions called by the target) */
    outgoing: [out1,out2]
};

export { sampleInput };