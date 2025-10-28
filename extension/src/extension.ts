import * as fs from 'fs';
import { sampleInput } from './sampleinput';

// --- Data processing logic moved inside 'activate' function ---

// below is for testing validity of ${ elements }, simply replace with latest ui stuffs

import * as vscode from 'vscode'; //
const util = require('node:util'); //

export function activate(context: vscode.ExtensionContext) { //

    // Create a dedicated output channel for logging
    const outputChannel = vscode.window.createOutputChannel('Code Graph');
    outputChannel.appendLine("==> Activating graph extension in experiments/graphdata...");

    let disposable = vscode.commands.registerCommand('thoughtflow.debug.testGraph', () => { //
        // Log command execution and show the channel to the user
        outputChannel.appendLine("==> 'graph.run' command executed!");
        outputChannel.show(); // Automatically show the output panel

        const panel = vscode.window.createWebviewPanel( //
            'codeGraphPanel', // Internal ID for the webview panel
            'Code Graph', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Show the new webview panel in the first editor column
            {
                // Enable javascript in the webview
                enableScripts: true, //
                localResourceRoots: [ //
                  vscode.Uri.joinPath(context.extensionUri, 'src/templates')
              ]
            }
        );

        // var data = ""; // // Not strictly needed anymore // [REMOVED]
        try{
            // --- Modification Start ---
            // Data processing logic moved inside the try...catch block
            
            // id: pack the information to form a unique id; not for display
            const baseid = sampleInput.target.filePath.replace(/(\/|\.)/gm, "_") + sampleInput.target.line + sampleInput.target.name;
            
            // label: for display
            const baselabel = sampleInput.target.filePath + ' line' + sampleInput.target.line + ' ' + sampleInput.target.name;

            const nodesArray: any[] = []; // Use an array to store node objects
            const edgesArray: any[] = []; // Use an array to store edge objects

            // Add the base node
            nodesArray.push({
                data: {
                    id: baseid,
                    label: baselabel,
                }
            });

            const addedNodeIds = new Set<string>([baseid]); // Use a Set to track added node IDs to avoid duplicates

            var id = ''; // Define id here
            var label = ''; // Define label here

            // Process incoming edges and nodes
            for (const item of sampleInput.incoming){

                // id: pack the information to form a unique id; not for display
                id = item.filePath.replace(/(\/|\.)/gm, "_") + item.line + item.name;

                // label: for display
                label = item.filePath + ' line' + item.line + ' ' + item.name;

                // If the node hasn't been added, add it to the array
                if(!addedNodeIds.has(id)){ //
                    nodesArray.push({
                        data: {
                            id: id,
                            label: label,
                        }
                    });
                    addedNodeIds.add(id); //
                }
                // Add the edge
                edgesArray.push({ //
                    data: {
                        source: id, // source for incoming is id
                        target: baseid
                    }
                });
            }

            // Process outgoing edges and nodes
            for (const item of sampleInput.outgoing){ //

                // id: pack the information to form a unique id; not for display
                id = item.filePath.replace(/(\/|\.)/gm, "_") + item.line + item.name;

                // label: for display
                label = item.filePath + ' line' + item.line + ' ' + item.name;

                // If the node hasn't been added, add it to the array
                if(!addedNodeIds.has(id)){ //
                    nodesArray.push({
                        data: {
                            id: id,
                            label: label,
                        }
                    });
                    addedNodeIds.add(id); //
                }
                // Add the edge
                edgesArray.push({ //
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

            outputChannel.appendLine("Generated elements JSON: " + elements); // Log to output channel
            // --- Modification End ---

            // Set the HTML content for the webview panel
            const graphDataString = elements; // // Use the generated JSON string

            const webviewFolderPathOnDisk = vscode.Uri.joinPath( //
              context.extensionUri, 'src/templates'
          );

            const htmlPathOnDisk = vscode.Uri.joinPath(webviewFolderPathOnDisk, 'graphView.html'); //

            let htmlContent = fs.readFileSync(htmlPathOnDisk.fsPath, 'utf8'); //

            const cssPathOnDisk = vscode.Uri.joinPath(webviewFolderPathOnDisk, 'graphStyle.css'); //
            const scriptPathOnDisk = vscode.Uri.joinPath(webviewFolderPathOnDisk, 'graphScript.js'); //

            const cssUri = panel.webview.asWebviewUri(cssPathOnDisk); //
            const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk); //

            htmlContent = htmlContent.replace('${graphDataJson}', graphDataString); //
            htmlContent = htmlContent.replace('${cssUri}', cssUri.toString()); //
            htmlContent = htmlContent.replace('${scriptUri}', scriptUri.toString()); //

            panel.webview.html = htmlContent; //

            console.log( htmlContent );
        }
        catch (error){ //
            // Log errors to the output channel and notify the user
            outputChannel.appendLine(`[ERROR] Failed to run Code Graph: ${error}`);
            vscode.window.showErrorMessage('Failed to run Code Graph. Check the "Code Graph" output panel for details.');
        }

    });

    context.subscriptions.push(disposable); //
}

// This method is called when your extension is deactivated
export function deactivate() {} //