import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import DashboardContent from "@/components/DashboardContent";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const families = await prisma.family.findMany({
    where: { memberships: { some: { userId: session.user.id } } },
    include: {
      _count: { select: { persons: true, memberships: true } },
      memberships: { where: { userId: session.user.id }, select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Navbar user={session.user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <DashboardContent
          user={{ id: session.user.id, name: session.user.name }}
          families={families.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            photo: f.photo,
            role: f.memberships[0]?.role ?? "MEMBER",
            personCount: f._count.persons,
            memberCount: f._count.memberships,
          }))}
        />
      </main>
    </>
  );
}
