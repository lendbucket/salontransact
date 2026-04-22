import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[AUTH] authorize called for:", credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Missing credentials");
          return null;
        }

        const email = credentials.email.toLowerCase().trim();

        try {
          // Magic link flow
          if (credentials.password.startsWith("MAGIC:")) {
            const code = credentials.password.replace("MAGIC:", "");
            console.log(
              "[AUTH] Magic link attempt for:",
              email,
              "code:",
              code.substring(0, 8)
            );
            const reset = await prisma.passwordReset.findFirst({
              where: {
                email,
                token: code,
                used: false,
                expiresAt: { gt: new Date() },
              },
            });
            if (!reset) {
              console.log("[AUTH] Invalid or expired magic code");
              return null;
            }
            await prisma.passwordReset.update({
              where: { id: reset.id },
              data: { used: true },
            });
            const user = await prisma.user.findUnique({
              where: { email },
            });
            if (!user) {
              console.log("[AUTH] User not found after magic verify");
              return null;
            }
            console.log("[AUTH] Magic link success for:", user.email);
            return {
              id: user.id,
              email: user.email,
              name: user.name ?? "",
              role: user.role,
            };
          }

          // Normal password flow
          const user = await prisma.user.findUnique({
            where: { email },
          });
          if (!user) {
            console.log("[AUTH] User not found:", email);
            return null;
          }
          if (!user.password) {
            console.log("[AUTH] No password set for user:", email);
            return null;
          }
          const valid = await bcrypt.compare(
            credentials.password,
            user.password
          );
          console.log("[AUTH] Password valid:", valid, "for:", email);
          if (!valid) return null;

          console.log(
            "[AUTH] Login success for:",
            user.email,
            "role:",
            user.role
          );
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? "",
            role: user.role,
          };
        } catch (error) {
          console.error("[AUTH] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id =
          token.id as string;
        (session.user as { id?: string; role?: string }).role =
          token.role as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
};
