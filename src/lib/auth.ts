import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { prompt: "select_account" } },
    })
  );
}

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
    })
  );
}

export const demoMode = process.env.DEMO_MODE !== "false";

// Email & password sign-in (built-in accounts)
const credentialsProvider = Credentials({
  id: "credentials",
  name: "Email & Password",
  credentials: {
    email: { label: "Email", type: "text" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = String(credentials?.email ?? "").trim().toLowerCase();
    const password = String(credentials?.password ?? "");
    if (!email || !password) return null;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return { id: user.id, name: user.name, email: user.email, image: user.image };
  },
});

providers.push(credentialsProvider);

// TEMPORARY fallback so the deployment works before AUTH_SECRET is added in
// the Vercel dashboard. Set a real AUTH_SECRET env var before going public
// (it must differ from this placeholder).
const authSecret =
  process.env.AUTH_SECRET ?? "temp-ed91aec5ee62bb80174b65393521e864f2e6acb431d66dae";

if (demoMode) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "text" },
      },
      async authorize(credentials) {
        const name = String(credentials?.name ?? "").trim();
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return null;
        }
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { name, email },
        });
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub) session.user.id = token.sub;
      return session;
    },
  },
});
