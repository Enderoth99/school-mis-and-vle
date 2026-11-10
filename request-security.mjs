// PUBLIC_ORIGIN is explicit in hosted deployments; never trust forwarded hosts.
export function sameOrigin(req){if(!req.headers.origin)return true;const expected=process.env.WIST_PUBLIC_ORIGIN||`http://${req.headers.host}`;return req.headers.origin===expected;}
export const sessionCookieFlags=()=>`HttpOnly; SameSite=Strict; Path=${process.env.WIST_BASE_PATH?process.env.WIST_BASE_PATH+'/':'/'}${process.env.WIST_PUBLIC_ORIGIN?.startsWith('https://')?'; Secure':''}`;
