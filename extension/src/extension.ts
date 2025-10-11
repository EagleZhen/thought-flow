// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// The commandId parameter must match the command field in package.json
	// I5MPORTANT: Replace 'graph.helloWorld' with your actual command name from package.json
	let disposable = vscode.commands.registerCommand('graph.run', () => {

		const dir_path = path.dirname(__dirname); // get abs path of our extension package directory
		console.log(dir_path, 'launched at', process.cwd());

		// Create and show a new webview panel
		const panel = vscode.window.createWebviewPanel(
			'codeGraphPanel', // Internal ID for the webview panel
			'Code Graph', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Show the new webview panel in the first editor column
			{
				// Enable javascript in the webview
				enableScripts: true 
			}
		);

		var pycmd = dir_path + '/graphdata/.venv/scripts/python.exe ' + dir_path + '/graphdata/graphdata.py"';
		console.log(`running command: ${pycmd}...`);
		var data = "";
		async function waitGraphData(){
			try{
				const { stdout, _ } = await exec(pycmd);
				data = stdout.replace(/(\r\n|\n|\r)/gm, "");
				console.log(`data = ${data}`);
				console.log(drawGraph(data));

				// Set the HTML content for the webview panel
				panel.webview.html = drawGraph(data);
			}
			catch (error){
				console.log(error);
			}
		}
		waitGraphData();
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}


/**
 * Returns the HTML content for the webview panel.
 * This contains the CSS, the Cytoscape.js library, and the script to fetch and render the graph.
 */
function drawGraph(data: string) {
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