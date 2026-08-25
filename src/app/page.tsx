import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import LandingContent from "@/components/LandingContent";

export default async function HomePage() {
  const session = await auth();
  return (
    <>
      <Navbar user={session?.user ?? null} />
      <main className="flex-1">
        <LandingContent signedIn={!!session?.user} />
      </main>
    </>
  );
}
