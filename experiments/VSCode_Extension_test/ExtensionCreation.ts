import * as vscode from 'vscode';

export async function getCallHierarchy(
    document: vscode.TextDocument,
    position: vscode.Position
) {
    // Step 1: Prepare call hierarchy at the cursor position (e.g., on a function name)
    const hierarchy = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        document.uri,
        position
    );

    if (!hierarchy || hierarchy.length === 0) {
        console.log('No symbol found at this position');
        return null;
    }

    const item = hierarchy[0]; // The function at cursor position

    // Step 2: Get incoming calls (who calls this function)
    const incomingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideIncomingCalls',
        item
    );

    // Step 3: Get outgoing calls (what this function calls)
    const outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideOutgoingCalls',
        item
    );

    return {
        function: item,
        callers: incomingCalls,
        callees: outgoingCalls
    };
}

// Example: Get call hierarchy for the current cursor position
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('myExtension.showCallHierarchy', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const result = await getCallHierarchy(editor.document, editor.selection.active);
        
        if (result) {
            console.log(`Function: ${result.function.name}`);
            console.log('\nCallers (incoming):');
            result.callers?.forEach(call => {
                console.log(`  - ${call.from.name} calls this at line ${call.fromRanges[0].start.line}`);
            });
            
            console.log('\nCallees (outgoing):');
            result.callees?.forEach(call => {
                console.log(`  - This calls ${call.to.name} at line ${call.fromRanges[0].start.line}`);
            });
        }
    });

    context.subscriptions.push(disposable);
}