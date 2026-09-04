import { prisma } from "@/lib/db";

/** Options shared by the deal create/edit forms. */
export async function loadDealFormData(orgId: string) {
  const [pipelines, members, companies, contacts] = await Promise.all([
    prisma.pipeline.findMany({
      where: { orgId, archived: false },
      orderBy: { position: "asc" },
      include: {
        stages: { orderBy: { position: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.company.findMany({
      where: { orgId, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.contact.findMany({
      where: { orgId, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return {
    pipelines: pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: p.stages,
    })),
    members: members.map((m) => ({ id: m.user.id, name: m.user.name })),
    companies,
    contacts,
  };
}
