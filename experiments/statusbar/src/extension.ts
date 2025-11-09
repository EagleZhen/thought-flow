import * as vscode from 'vscode';
import config from "./auth/config";
import { getStoredToken, saveToken, clearToken } from "./auth/tokenHelpers";
import { getVerifiedAuthToken, checkTokenValidity, getLogin } from "./auth/index";
const chalk = require('chalk'); // don't change this ! must use require !

const myStatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
let userName = "";
updateStatusBarItem(userName);

export function activate({ subscriptions }: vscode.ExtensionContext) {
    const myCommandId = 'experiment.userManagement';

    // register a command that is invoked when the status bar
    // item is selected
    subscriptions.push(vscode.commands.registerCommand(myCommandId, async () => {

        if (userName === ""){
            console.log("checking if already authorized...");
            // console.log(config.TOKEN_FILE);
            const storedToken = getStoredToken(config.TOKEN_FILE);
            let theToken = null;
            try {
                if (storedToken !== null) {
                    if (await checkTokenValidity(storedToken)) {
                        console.log("User is already authorized!\n");
                        theToken = storedToken;
                    } 
                    else {
                        console.error("\nLooks Like Your Token Expired! Initiating Authorization\n");
                        clearToken(config.TOKEN_FILE);

                        const tokenData = await getVerifiedAuthToken();
                        saveToken(tokenData, config.TOKEN_FILE);
                        theToken = tokenData.token;
                    }
                } 
                else {
                    const tokenData = await getVerifiedAuthToken();
                    saveToken(tokenData, config.TOKEN_FILE);
                    theToken = tokenData.token;
                }

                userName = await getLogin(theToken);
                // console.log("Hello, %s", userName);
                updateStatusBarItem(userName);
            } 
            catch (error) {
                interface myError { message: string };
                const e = error as myError;
                console.log(chalk.red(e.message));
            }
        } else { // already logged in

            const selection = await vscode.window.showQuickPick([
                {
                    label: "Upgrade",
                    description: "Enter license key for upgraging",
                },
                {
                    label: "Logout",
                    description: `Remove account data of ${ userName }`,
                }
            ], {
                placeHolder: "Select an action",
                title: "Thought Flow Settings"
            });

            if (selection) {
                if (selection.label === "Upgrade") {
                    const licenseKey = vscode.window.showInputBox({
                        placeHolder: "Please enter your license key",
                    });
                } 
                else if (selection.label === "Logout") {
                    vscode.window.showInformationMessage(
                        `Logout from "${ userName }"?`, "Yes", "No"
                    ).then(answer => {
                        if (answer === "Yes") {
                            clearToken(config.TOKEN_FILE);
                            userName = "";
                            updateStatusBarItem(userName);
                        }
                    });
                }
            }
        }
    }));

    // create a new status bar item that we can now manage
    myStatusBarItem.command = myCommandId; // run myCommand on click
	subscriptions.push(myStatusBarItem);
}

function updateStatusBarItem( username: string ): void {
    if (username !== "") {
        myStatusBarItem.text = `Logged in as ${username}`;
        myStatusBarItem.show();
    } else {
        myStatusBarItem.text = `Please log in`;
        myStatusBarItem.show();
    }
}
