import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import FamilySettings from "@/components/FamilySettings";

export default async function FamilySettingsPage({
  params,
}: PageProps<"/family/[id]/settings">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId: id } },
  });
  if (!membership) redirect("/dashboard");

  const family = await prisma.family.findUnique({ where: { id } });
  if (!family) redirect("/dashboard");

  const members = await prisma.membership.findMany({
    where: { familyId: id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <Navbar user={session.user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <FamilySettings
          me={{ id: session.user.id }}
          myRole={membership.role}
          family={{
            id: family.id,
            name: family.name,
            description: family.description,
            inviteCode: family.inviteCode,
            createdById: family.createdById,
          }}
          members={members.map((m) => ({
            userId: m.userId,
            role: m.role,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
          }))}
        />
      </main>
    </>
  );
}
