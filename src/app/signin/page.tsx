import { redirect } from "next/navigation";
import { auth, demoMode } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import SignInPanel from "@/components/SignInPanel";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <Navbar user={null} />
      <main className="flex flex-1 items-center justify-center px-4 py-14">
        <SignInPanel demoMode={demoMode} providers={{ google: !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET, facebook: !!process.env.AUTH_FACEBOOK_ID && !!process.env.AUTH_FACEBOOK_SECRET }} />
      </main>
    </>
  );
}
