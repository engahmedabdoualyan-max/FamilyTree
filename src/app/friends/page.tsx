import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import FriendsPage from "@/components/FriendsPage";

export default async function FriendsRoute() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return (
    <>
      <Navbar user={session.user} />
      <main className="flex flex-1 flex-col">
        <FriendsPage />
      </main>
    </>
  );
}
