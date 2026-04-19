"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const [email, setEmail] = useState("dev@example.com");
  const [name, setName] = useState("Dev User");
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <main className="flex flex-col flex-1 items-center justify-center min-h-screen px-6 gap-8 text-center">
      {/* Header — matches landing page */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl" role="img" aria-label="Running shoe">👟</span>
        <h1 className="text-3xl font-bold text-charcoal">Sign in</h1>
        <p className="text-lg text-gray-500 max-w-xs">
          to Saturday Morning
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          variant="secondary"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </Button>

        <Button
          variant="secondary"
          onClick={() => signIn("facebook", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-2 border-[#1877F2] text-[#1877F2] hover:bg-[#1877F2]/10"
        >
          <svg className="w-5 h-5 fill-[#1877F2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Continue with Facebook
        </Button>
      </div>

      {isDev && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-xs text-gray-400 uppercase">Dev only</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn("credentials", { email, name, callbackUrl: "/" });
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-full border-2 border-teal/30 px-6 py-3 text-base bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-full border-2 border-teal/30 px-6 py-3 text-base bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <Button variant="primary" type="submit" className="w-full">
              Dev Sign In
            </Button>
          </form>
        </div>
      )}

      <p className="text-sm text-gray-400">
        <Link href="/" className="text-teal underline">Back to home</Link>
      </p>
    </main>
  );
}
