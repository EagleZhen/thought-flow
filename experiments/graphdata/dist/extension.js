/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"function":"run","uri":"toy_py/app.py","line":4,"incoming":[{"from":"run","uri":"toy_py/app.py","line":4},{"from":"run","uri":"toy_py/app.py","line":12}],"outgoing":[{"to":"add","uri":"toy_py/app.py","line":6},{"to":"mul","uri":"toy_py/app.py","line":7}]}');

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("vscode");

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   activate: () => (/* binding */ activate),
/* harmony export */   deactivate: () => (/* binding */ deactivate)
/* harmony export */ });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _callHierarchy_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(vscode__WEBPACK_IMPORTED_MODULE_2__);

//const graphdata = require('./callHierarchy.json')
// import * as graphdata from './callHierarchy.json';
 //
// import graphdata from './callHierarchy.json';
const baseid = _callHierarchy_json__WEBPACK_IMPORTED_MODULE_1__.uri.replace(/(\/|\.)/gm, "_") + '_' + _callHierarchy_json__WEBPACK_IMPORTED_MODULE_1__["function"]; //
// console.log(`cid = ${ baseid }`);
const baselabel = baseid; //
// console.log(`clabel = ${ baselabel }`);
// --- Modification Start ---
const nodesArray = []; // Use an array to store node objects
const edgesArray = []; // Use an array to store edge objects
// Add the base node
nodesArray.push({
    data: {
        id: baseid,
        label: baselabel,
    }
});
const addedNodeIds = new Set([baseid]); // Use a Set to track added node IDs to avoid duplicates
var id = ''; // Define id here
var label = ''; // Define label here
// Process incoming edges and nodes
for (const item of _callHierarchy_json__WEBPACK_IMPORTED_MODULE_1__.incoming) { //
    id = item.uri.replace(/(\/|\.)/gm, "_") + '_line' + item.line; //
    // console.log(id);
    label = item.uri + ' line' + item.line; //
    // If the node hasn't been added, add it to the array
    if (!addedNodeIds.has(id)) { //
        nodesArray.push({
            data: {
                id: id,
                label: label,
            }
        });
        addedNodeIds.add(id); //
    }
    // Add the edge
    edgesArray.push({
        data: {
            source: id, // source for incoming is id
            target: baseid
        }
    });
}
// Process outgoing edges and nodes
for (const item of _callHierarchy_json__WEBPACK_IMPORTED_MODULE_1__.outgoing) { //
    // id = (item as any).uri.replace(/(\/|\.)/gm, "_") + '_line' + (item as any).line + '_' + (item as any).uri.to(/(\/|\.)/gm, "_");
    id = item.uri.replace(/(\/|\.)/gm, "_") + '_' + item.to; //
    // console.log(id);
    label = item.uri + ' line' + item.line; //
    // If the node hasn't been added, add it to the array
    if (!addedNodeIds.has(id)) { //
        nodesArray.push({
            data: {
                id: id,
                label: label,
            }
        });
        addedNodeIds.add(id); //
    }
    // Add the edge
    edgesArray.push({
        data: {
            source: baseid,
            target: id // target for outgoing is id
        }
    });
}
// Use JSON.stringify to convert the object containing arrays into a valid JSON string
const elementsObject = {
    nodes: nodesArray,
    edges: edgesArray
};
const elements = JSON.stringify(elementsObject); // <-- Generate standard JSON string directly
console.log("Generated elements JSON:", elements); // Log the generated JSON
// --- Modification End ---
// below is for testing validity of ${ elements }, simply replace with latest ui stuffs
 //
const util = __webpack_require__(3); //
function activate(context) {
    console.log("==> Activating graph extension in experiments/graphdata..."); // Log activation
    let disposable = vscode__WEBPACK_IMPORTED_MODULE_2__.commands.registerCommand('graph.run', () => {
        console.log("==> 'graph.run' command executed!"); // Log command execution
        const panel = vscode__WEBPACK_IMPORTED_MODULE_2__.window.createWebviewPanel(//
        'codeGraphPanel', // Internal ID for the webview panel
        'Code Graph', // Title of the panel displayed to the user
        vscode__WEBPACK_IMPORTED_MODULE_2__.ViewColumn.One, // Show the new webview panel in the first editor column
        {
            // Enable javascript in the webview
            enableScripts: true, //
            localResourceRoots: [
                vscode__WEBPACK_IMPORTED_MODULE_2__.Uri.joinPath(context.extensionUri, 'webview')
            ]
        });
        var data = ""; // // Not strictly needed anymore
        try { //
            // Set the HTML content for the webview panel
            const graphDataString = elements; // // Use the generated JSON string
            const webviewFolderPathOnDisk = vscode__WEBPACK_IMPORTED_MODULE_2__.Uri.joinPath(//
            context.extensionUri, 'webview');
            const htmlPathOnDisk = vscode__WEBPACK_IMPORTED_MODULE_2__.Uri.joinPath(webviewFolderPathOnDisk, 'graphView.html'); //
            let htmlContent = fs__WEBPACK_IMPORTED_MODULE_0__.readFileSync(htmlPathOnDisk.fsPath, 'utf8'); //
            const cssPathOnDisk = vscode__WEBPACK_IMPORTED_MODULE_2__.Uri.joinPath(webviewFolderPathOnDisk, 'graphStyle.css'); //
            const scriptPathOnDisk = vscode__WEBPACK_IMPORTED_MODULE_2__.Uri.joinPath(webviewFolderPathOnDisk, 'graphScript.js'); //
            const cssUri = panel.webview.asWebviewUri(cssPathOnDisk); //
            const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk); //
            htmlContent = htmlContent.replace('${graphDataJson}', graphDataString); //
            htmlContent = htmlContent.replace('${cssUri}', cssUri.toString()); //
            htmlContent = htmlContent.replace('${scriptUri}', scriptUri.toString()); //
            panel.webview.html = htmlContent; //
        }
        catch (error) { //
            console.log(error);
        }
    });
    context.subscriptions.push(disposable); //
}
// This method is called when your extension is deactivated
function deactivate() { } //

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map