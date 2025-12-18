export default {
  atob: (token: string) => Buffer.from(token).toString("base64"),
  btoa: (base64token: string) => Buffer.from(base64token, "base64").toString("ascii"),
};