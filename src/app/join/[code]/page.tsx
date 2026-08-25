import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function JoinPage({
  params,
}: PageProps<"/join/[code]">) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/signin?callbackUrl=/join/${code}`);

  const family = await prisma.family.findUnique({ where: { inviteCode: code.toUpperCase() } });
  if (!family) redirect("/dashboard");

  const existing = await prisma.membership.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId: family.id } },
  });
  if (!existing) {
    await prisma.membership.create({
      data: { userId: session.user.id, familyId: family.id, role: "MEMBER" },
    });
  }
  redirect(`/family/${family.id}`);
}
