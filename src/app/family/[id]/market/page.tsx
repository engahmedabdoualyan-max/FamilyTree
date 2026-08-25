import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import FamilyPageHeader from "@/components/FamilyPageHeader";
import MarketView from "@/components/MarketView";

export default async function MarketPage({
  params,
}: PageProps<"/family/[id]/market">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId: id } },
  });
  if (!membership) redirect("/dashboard");

  return (
    <>
      <Navbar user={session.user} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <FamilyPageHeader
          familyId={id}
          familyName={membership ? (await prisma.family.findUnique({ where: { id }, select: { name: true } }))?.name ?? "" : ""}
          active="market"
          isAdmin={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <MarketView familyId={id} me={{ id: session.user.id }} />
      </main>
    </>
  );
}
