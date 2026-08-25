import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyTreeData } from "@/lib/tree-data";
import Navbar from "@/components/Navbar";
import FamilyPageHeader from "@/components/FamilyPageHeader";
import ClubView from "@/components/ClubView";

export default async function ClubPage({
  params,
}: PageProps<"/family/[id]/club">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId: id } },
  });
  const data = await getFamilyTreeData(id);
  if (!membership || !data) redirect("/dashboard");

  return (
    <>
      <Navbar user={session.user} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <FamilyPageHeader
          familyId={data.family.id}
          familyName={data.family.name}
          active="club"
          isAdmin={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <ClubView familyId={data.family.id} persons={data.persons} />
      </main>
    </>
  );
}
