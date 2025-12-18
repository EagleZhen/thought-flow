import unauthentication from "./unauthentication";
import { getOAuthObject } from "./oauth";

async function getAuthenticationObject() {
    try {
        const oAuthObject = await getOAuthObject();
        
        if (Object.prototype.hasOwnProperty.call(oAuthObject, "error")) {
            interface myoAuthObj { error: string };
            const myoAobj = oAuthObject as myoAuthObj;
            console.error( myoAobj.error );
            return {
                authStatus: unauthentication.type,
                reason: unauthentication.reason(myoAobj.error),
                token: "NA",
            };
        } else {
            interface myoAuthObj { token: string };
            const myoAobj = oAuthObject as myoAuthObj;
            // console.log( `Authenticated` );
            return {
                authStatus: "authenticated",
                reason: "user authorized via Device Flow in Browser",
                token: myoAobj.token,
            };
        }
    } catch (err) {
        interface myError { message: string };
        const e = err as myError;
        console.error( e.message );
        return {
            authStatus: unauthentication.type,
            reason: e.message,
            token: "NA",
        };
    }
}

export { getAuthenticationObject };