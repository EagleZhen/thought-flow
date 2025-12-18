import { getAuthenticationObject } from "./authObject";
import { Octokit } from "@octokit/rest";
// import chalk from "chalk";
const chalk = require('chalk'); // don't change this ! must use require!

const getLogin = async (token: string | undefined) => {
    const octokit = new Octokit({auth:token});
    const response = await octokit.rest.users.getAuthenticated();
    return response.data.login;
};

async function checkTokenValidity(token: string | undefined) {
    try {
        const userName = await getLogin(token); // If this works without errors, the token is valid
        if (userName.length > 0) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        interface myError { status: number, message: undefined };
        const e = error as myError;
        if (e.status >= 401) {
            return false;
        } else {
            throw new Error("Error checking token:", e.message);
        }
    }
}

async function verifyAuthStatus(token: string, authStatus: string, reason: string) {
    try {
        if (token !== "NA") {
            console.log(chalk.greenBright(reason));
            return authStatus;
        } else {
            // condition for unsuccessful oauth
            console.error(reason);
            return authStatus;
        }
    } catch (err) {
        // condition for unknown errors
        
        interface myError { message: string };
        const e = err as myError;
        console.error(e.message);
        process.exit(1);
    }
}

async function getVerifiedAuthToken() {
    const { token, authStatus, reason } = await getAuthenticationObject();
    const currentAuthStatus = await verifyAuthStatus(token, authStatus, reason);
    if (currentAuthStatus === "unauthenticated") {
        process.exit(1);
    } else {
        const tokenData = { token: token, type: "oauth" };
        return tokenData;
    }
}

export {
    getLogin, getVerifiedAuthToken, checkTokenValidity,
};