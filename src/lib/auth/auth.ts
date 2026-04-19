import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../prisma";

const isDev = process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google,
    Facebook,
    // Dev-only credentials provider: sign in with any email, no password needed
    ...(isDev
      ? [
          Credentials({
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "dev@example.com" },
              name: { label: "Name", type: "text", placeholder: "Dev User" },
            },
            async authorize(credentials) {
              const email = credentials?.email as string;
              if (!email) return null;
              const name = (credentials?.name as string) || "Dev User";

              // Find or create user
              let user = await prisma.user.findUnique({ where: { email } });
              if (!user) {
                user = await prisma.user.create({
                  data: { email, name },
                });
              }
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  // JWT strategy is needed for Credentials provider compatibility
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
