import { PublicClientApplication, Configuration, RedirectRequest } from "@azure/msal-browser";

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_B2C_CLIENT_ID!,
    authority: `https://${process.env.NEXT_PUBLIC_AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.NEXT_PUBLIC_AZURE_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.NEXT_PUBLIC_AZURE_B2C_SIGNUP_SIGNIN_POLICY}`,
    knownAuthorities: [
      `${process.env.NEXT_PUBLIC_AZURE_B2C_TENANT_NAME}.b2clogin.com`,
    ],
    redirectUri: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000/api/auth/callback",
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000/",
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

let _msalInstance: PublicClientApplication | null = null;
export function getMsalInstance() {
  if (typeof window === "undefined") return null;
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication(msalConfig);
  }
  return _msalInstance;
}

export const loginRequest: RedirectRequest = {
  scopes: ["openid", "profile", "email"],
};
