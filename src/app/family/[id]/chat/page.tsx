import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyTreeData } from "@/lib/tree-data";
import Navbar from "@/components/Navbar";
import FamilyPageHeader from "@/components/FamilyPageHeader";
import ChatView from "@/components/ChatView";

export default async function ChatPage({
  params,
}: PageProps<"/family/[id]/chat">) {
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
          active="chat"
          isAdmin={["OWNER", "ADMIN"].includes(membership.role)}
        />
        <ChatView
          familyId={data.family.id}
          me={{ id: session.user.id, name: session.user.name, image: session.user.image }}
        />
      </main>
    </>
  );
}
