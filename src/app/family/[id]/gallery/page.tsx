import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyTreeData } from "@/lib/tree-data";
import Navbar from "@/components/Navbar";
import FamilyPageHeader from "@/components/FamilyPageHeader";
import GalleryView from "@/components/GalleryView";

export default async function GalleryPage({
  params,
}: PageProps<"/family/[id]/gallery">) {
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
          active="photos"
          isAdmin={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <GalleryView
          familyId={data.family.id}
          persons={data.persons.filter((p) => !p.familyName)}
          me={{ id: session.user.id }}
          myRole={membership.role}
        />
      </main>
    </>
  );
}
