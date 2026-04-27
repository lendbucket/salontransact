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
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) return null;

        // Magic link flow
        if (credentials.password.startsWith("MAGIC:")) {
          const code = credentials.password.replace("MAGIC:", "");
          const reset = await prisma.passwordReset.findFirst({
            where: {
              email,
              token: code,
              used: false,
              expiresAt: { gt: new Date() },
            },
          });
          if (!reset) return null;
          await prisma.passwordReset.update({
            where: { id: reset.id },
            data: { used: true },
          });
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? "",
            role: user.role,
            emailVerified: user.emailVerified?.toISOString() ?? null,
            approvalStatus: (user as unknown as { approvalStatus: string }).approvalStatus,
          };
        }

        // Normal password flow
        const valid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? "",
          role: user.role,
          emailVerified: user.emailVerified?.toISOString() ?? null,
          approvalStatus: (user as unknown as { approvalStatus: string }).approvalStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.emailVerified = (user as unknown as { emailVerified: string | null }).emailVerified;
        token.approvalStatus = (user as unknown as { approvalStatus: string }).approvalStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as { id?: string; role?: string; emailVerified?: string | null; approvalStatus?: string };
        u.id = token.id as string;
        u.role = token.role as string;
        u.emailVerified = token.emailVerified as string | null;
        u.approvalStatus = token.approvalStatus as string;
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
