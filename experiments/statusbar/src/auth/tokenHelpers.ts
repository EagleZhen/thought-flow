import { existsSync, readFileSync, writeFileSync } from "fs";
import converter from "./base64";

function getStoredToken(TOKEN_FILE: string) {
  if (existsSync(TOKEN_FILE)) {
    const tokenData = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    if (tokenData && tokenData.token) {
      return converter.btoa(tokenData.token);
    }
  } else {
    return null;
  }
}

// Save token and the authType to a file with type key
function saveToken(tokenData, TOKEN_FILE: string) {
  tokenData.token = converter.atob(tokenData.token);
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
}

// Clear token from storage and set type to unauthenticated
function clearToken(TOKEN_FILE: string) {
  if (existsSync(TOKEN_FILE)) {
    const dataToSave = {
      token: null,
      type: "unauthenticated",
    };
    writeFileSync(TOKEN_FILE, JSON.stringify(dataToSave, null, 2));
  }
}

export { getStoredToken, saveToken, clearToken };