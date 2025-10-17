//const graphdata = require('./callHierarchy.json')
// import * as graphdata from './callHierarchy.json';
import graphdata from '../callHierarchy.json' with { type: "json" };
// import graphdata from './callHierarchy.json';

const baseid = graphdata.uri.replace(/(\/|\.)/gm, "_") + '_' +graphdata.function;
// console.log(`cid = ${ baseid }`);
const baselabel = baseid;
// console.log(`clabel = ${ baselabel }`);

var nodestr = '[';
var edgestr = '[';
nodestr += `{
            "data": {
                "id": "${ baseid }",
                "label": "${ baselabel }",
            }
        }, `;
var nodes: string[] = [];
nodes.push(baseid);

var id = '';
var label = '';

for (const item of graphdata.incoming){
    id = (item as any).uri.replace(/(\/|\.)/gm, "_") + '_line' + (item as any).line;
    // console.log(id);
    label = (item as any).uri + ' line' + (item as any).line;
    
    if(!(nodes.includes(id))){
        nodestr += `{
            "data": {
                "id": "${ id }",
                "label": "${ label }",
            }
        },`;
        nodes.push(id);
    }
    edgestr += `{"data": {"source": "${ id }", "target": "${ baseid }"}}, `;
}

for (const item of graphdata.outgoing){
    // id = (item as any).uri.replace(/(\/|\.)/gm, "_") + '_line' + (item as any).line + '_' + (item as any).uri.to(/(\/|\.)/gm, "_");
    id = (item as any).uri.replace(/(\/|\.)/gm, "_") + '_' + (item as any).to;
    // console.log(id);
    label = (item as any).uri + ' line' + (item as any).line;
    
    if(!(nodes.includes(id))){
        nodestr += `{
            "data": {
                "id": "${ id }",
                "label": "${ label }",
            }
        },`;
        nodes.push(id);
    }
    edgestr += `{"data": {"source": "${ baseid }", "target": "${ id }"}}, `;
}

nodestr += ']';
edgestr += ']';
const elements = `{"nodes": ${ nodestr }, "edges": ${ edgestr }}`;
console.log(elements);

// below is for testing validity of ${ elements }, simply replace with latest ui stuffs

import * as vscode from 'vscode';
const util = require('node:util');

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('graph.run', () => {

        const panel = vscode.window.createWebviewPanel(
            'codeGraphPanel', // Internal ID for the webview panel
            'Code Graph', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Show the new webview panel in the first editor column
            {
                // Enable javascript in the webview
                enableScripts: true 
            }
        );

        var data = "";
        try{
            data = elements;
            console.log(`data = ${data}`);
            console.log(drawGraph(data));

            // Set the HTML content for the webview panel
            panel.webview.html = drawGraph(data);
        }
        catch (error){
            console.log(error);
        }

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