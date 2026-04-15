
import { PublicClientApplication, Configuration, RedirectRequest, AccountInfo } from "@azure/msal-browser";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const msalRef = useRef<PublicClientApplication | null>(null);
  const router = useRouter();

  // MSAL config and loginRequest must be defined here to ensure client-only usage
  const tenant = process.env.NEXT_PUBLIC_AZURE_B2C_TENANT_NAME;
  const clientId = process.env.NEXT_PUBLIC_AZURE_B2C_CLIENT_ID;
  const policy = process.env.NEXT_PUBLIC_AZURE_B2C_SIGNUP_SIGNIN_POLICY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!tenant || !clientId || !policy || !appUrl) {
    throw new Error(
      "Missing required Azure B2C environment variables. Please check NEXT_PUBLIC_AZURE_B2C_TENANT_NAME, NEXT_PUBLIC_AZURE_B2C_CLIENT_ID, NEXT_PUBLIC_AZURE_B2C_SIGNUP_SIGNIN_POLICY, and NEXT_PUBLIC_APP_URL."
    );
  }

  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: `https://${tenant}.b2clogin.com/${tenant}.onmicrosoft.com/${policy}`,
      knownAuthorities: [`${tenant}.b2clogin.com`],
      redirectUri: appUrl || "http://localhost:3000/api/auth/callback",
      postLogoutRedirectUri: appUrl || "http://localhost:3000/",
    },
    cache: {
      cacheLocation: "localStorage",
    },
  };
  const loginRequest: RedirectRequest = {
    scopes: ["openid", "profile", "email"],
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!msalRef.current) {
      msalRef.current = new PublicClientApplication(msalConfig);
    }
    const msal = msalRef.current;
    msal.initialize().then(() => {
      return msal.handleRedirectPromise();
    }).then(() => {
      const accounts = msal.getAllAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
      setLoading(false);
      setIsReady(true);
    }).catch(() => {
      setLoading(false);
      setIsReady(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    if (!isReady || !msalRef.current) return;
    await msalRef.current.loginRedirect(loginRequest);
  };

  const logout = () => {
    if (!isReady || !msalRef.current) return;
    msalRef.current.logoutRedirect();
  };

  return { account, loading, login, logout };
}
