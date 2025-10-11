/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(2));
const util = __webpack_require__(3);
const exec = util.promisify((__webpack_require__(4).exec));
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // This line of code will only be executed once when your extension is activated
    // The command has been defined in the package.json file
    // The commandId parameter must match the command field in package.json
    // I5MPORTANT: Replace 'graph.helloWorld' with your actual command name from package.json
    let disposable = vscode.commands.registerCommand('graph.run', () => {
        const dir_path = path.dirname(__dirname); // get abs path of our extension package directory
        console.log(dir_path, 'launched at', process.cwd());
        // Create and show a new webview panel
        const panel = vscode.window.createWebviewPanel('codeGraphPanel', // Internal ID for the webview panel
        'Code Graph', // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Show the new webview panel in the first editor column
        {
            // Enable javascript in the webview
            enableScripts: true
        });
        var pycmd = dir_path + '/graphdata/.venv/scripts/python.exe ' + dir_path + '/graphdata/graphdata.py"';
        console.log(`running command: ${pycmd}...`);
        var data = "";
        async function waitGraphData() {
            try {
                const { stdout, _ } = await exec(pycmd);
                data = stdout.replace(/(\r\n|\n|\r)/gm, "");
                console.log(`data = ${data}`);
                console.log(drawGraph(data));
                // Set the HTML content for the webview panel
                panel.webview.html = drawGraph(data);
            }
            catch (error) {
                console.log(error);
            }
        }
        waitGraphData();
    });
    context.subscriptions.push(disposable);
}
// This method is called when your extension is deactivated
function deactivate() { }
/**
 * Returns the HTML content for the webview panel.
 * This contains the CSS, the Cytoscape.js library, and the script to fetch and render the graph.
 */
function drawGraph(data) {
    return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Code Graph</title>

		<script src="https://unpkg.com/cytoscape@3.26.0/dist/cytoscape.min.js"></script>
		
		<style>
			body { margin: 0; padding: 0; overflow: hidden; }
			#cy {
				width: 100vw; /* 100% of viewport width */
				height: 100vh; /* 100% of viewport height */
				display: block;
				position: absolute;
				top: 0;
				left: 0;
			}
		</style>
	</head>
	<body>
		<div id="cy"></div>

		<script>
			var data = ${data};
			initializeCytoscape(data);

			/**
			 * This function initializes the Cytoscape graph with the provided data.
			 * @param {object} data - The graph data from the server, expected format: { elements: [...] }
			 */
			function initializeCytoscape(data) {

				const cy = cytoscape({
					container: document.getElementById('cy'),
					elements: data,
					style: [
						{ 
							selector: 'node', 
							style: {
								'background-color': '#666', 
								'label': 'data(id)'
							}
						},
						{
							selector: 'node:parent', // Style for parent nodes
							style: {
								'background-opacity': 0.3,
								'background-color': '#ccc',
								'border-color': '#999',
								'border-width': 2,
								'label': 'data(label)'
							}
						},
						{ 
							selector: 'edge', 
							style: { 
								'width': 3, 
								'line-color': '#ccc', 
								'target-arrow-color': '#ccc', 
								'target-arrow-shape': 'triangle', 
								'curve-style': 'bezier' 
							}
						}
					],
					layout: { 
						name: 'cose', 
						idealEdgeLength: 100, 
						nodeOverlap: 20, 
						fit: true, 
						padding: 30 
					}
				});

				// Add a click listener to the nodes for future interactivity
				cy.on('tap', 'node', function(evt){
					const node = evt.target;
					console.log('Tapped node: ' + node.id());
					// You can add more interactive features here
				});
			}
		</script>
	</body>
	</html>`;
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("node:child_process");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map