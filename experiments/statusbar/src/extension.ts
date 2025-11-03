import * as vscode from 'vscode';

const myStatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
myStatusBarItem.text = `Please log in`;
myStatusBarItem.show();

export function activate({ subscriptions }: vscode.ExtensionContext) {
    const myCommandId = 'experiment.userManagement';

    // register a command that is invoked when the status bar
    // item is selected
    subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
        const idpwInput = vscode.window.showInputBox({
            placeHolder: "Please enter your username",
            validateInput: text => {
                return text === 'monokuma' ? null : 'Username unidentified';
            }
        });
        updateStatusBarItem('monokuma');
    }));

    // create a new status bar item that we can now manage
    myStatusBarItem.command = myCommandId; // run myCommand on click
	subscriptions.push(myStatusBarItem);
    // context.subscriptions.push(disposable);
}

function updateStatusBarItem( username: string ): void {
    if (username != null) {
        myStatusBarItem.text = `Logged in as ${username}`;
        myStatusBarItem.show();
    }
}
