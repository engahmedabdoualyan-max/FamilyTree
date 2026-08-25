import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyTreeData } from "@/lib/tree-data";
import Navbar from "@/components/Navbar";
import FamilyPageHeader from "@/components/FamilyPageHeader";
import OccasionsView from "@/components/OccasionsView";

export default async function OccasionsPage({
  params,
}: PageProps<"/family/[id]/occasions">) {
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
          active="occasions"
          isAdmin={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <OccasionsView
          familyId={data.family.id}
          me={{ id: session.user.id }}
          myRole={membership.role}
        />
      </main>
    </>
  );
}
