import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyTreeData } from "@/lib/tree-data";
import Navbar from "@/components/Navbar";
import FamilyWorkspace from "@/components/FamilyWorkspace";

export default async function FamilyPage({
  params,
}: PageProps<"/family/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId: id } },
  });
  const data = await getFamilyTreeData(id);
  if (!membership || !data) {
    return (
      <>
        <Navbar user={session.user} />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="text-5xl">🚫</div>
          <p className="text-lg font-bold text-bark-900">You are not a member of this family.</p>
          <a
            href="/dashboard"
            className="rounded-xl bg-leaf-600 px-5 py-2.5 font-bold text-white hover:bg-leaf-700"
          >
            Go to my families
          </a>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar user={session.user} />
      <main className="flex flex-1 flex-col">
        <FamilyWorkspace
          treeData={data}
          me={{ id: session.user.id, name: session.user.name, image: session.user.image }}
          myRole={membership.role}
        />
      </main>
    </>
  );
}
