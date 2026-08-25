import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyTreeData } from "@/lib/tree-data";
import Navbar from "@/components/Navbar";
import FamilyPageHeader from "@/components/FamilyPageHeader";
import DocumentsView from "@/components/DocumentsView";

export default async function DocumentsPage({
  params,
}: PageProps<"/family/[id]/documents">) {
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
          active="docs"
          isAdmin={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <DocumentsView
          familyId={data.family.id}
          persons={data.persons.filter((p) => !p.familyName)}
          me={{ id: session.user.id }}
          myRole={membership.role}
        />
      </main>
    </>
  );
}
