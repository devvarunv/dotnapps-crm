import { randomBytes } from "node:crypto";
import {
  PrismaClient,
  Prisma,
  type Role,
  type LeadSource,
  type LeadStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_TAGS = [
  { name: "VIP", color: "#7c3aed" },
  { name: "Hot Lead", color: "#dc2626" },
  { name: "Startup", color: "#0891b2" },
  { name: "Enterprise", color: "#1d4ed8" },
  { name: "Referral", color: "#16a34a" },
  { name: "High Value", color: "#d97706" },
  { name: "Follow Up", color: "#db2777" },
];

const DEMO_PASSWORD = "Password123!";

async function upsertUser(opts: {
  email: string;
  name: string;
  isSuperAdmin?: boolean;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: opts.email },
    create: {
      email: opts.email,
      name: opts.name,
      passwordHash,
      isSuperAdmin: opts.isSuperAdmin ?? false,
    },
    update: { name: opts.name, isSuperAdmin: opts.isSuperAdmin ?? false },
  });
}

async function main() {
  const [superAdmin, owner, manager, sales, viewer] = await Promise.all([
    upsertUser({
      email: "superadmin@dotnapps.test",
      name: "Sam Platform",
      isSuperAdmin: true,
    }),
    upsertUser({ email: "owner@dotnapps.test", name: "Olivia Owner" }),
    upsertUser({ email: "manager@dotnapps.test", name: "Marcus Manager" }),
    upsertUser({ email: "sales@dotnapps.test", name: "Sadie Sales" }),
    upsertUser({ email: "viewer@dotnapps.test", name: "Vic Viewer" }),
  ]);

  const org = await prisma.organization.upsert({
    where: { slug: "acme-inc" },
    create: { name: "Acme Inc.", slug: "acme-inc", createdById: owner.id },
    update: {},
  });

  const memberships: Array<[string, Role]> = [
    [owner.id, "OWNER"],
    [manager.id, "MANAGER"],
    [sales.id, "SALES"],
    [viewer.id, "VIEWER"],
  ];
  for (const [userId, role] of memberships) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId, orgId: org.id } },
      create: { userId, orgId: org.id, role },
      update: { role, status: "ACTIVE" },
    });
  }

  await prisma.invite.upsert({
    where: { orgId_email: { orgId: org.id, email: "invitee@dotnapps.test" } },
    create: {
      orgId: org.id,
      email: "invitee@dotnapps.test",
      role: "SALES",
      token: randomBytes(24).toString("hex"),
      invitedById: owner.id,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
    update: {},
  });

  await prisma.auditLog.create({
    data: {
      action: "org.create",
      orgId: org.id,
      actorId: owner.id,
      targetType: "Organization",
      targetId: org.id,
      metadata: { name: org.name, slug: org.slug, seeded: true },
    },
  });

  // --- CRM Core sample data (Phase 2) ------------------------------------
  for (const t of DEFAULT_TAGS) {
    await prisma.tag.upsert({
      where: { orgId_name: { orgId: org.id, name: t.name } },
      create: { orgId: org.id, name: t.name, color: t.color },
      update: { color: t.color },
    });
  }
  const tagByName = Object.fromEntries(
    (await prisma.tag.findMany({ where: { orgId: org.id } })).map((t) => [t.name, t.id]),
  );

  const existingLeads = await prisma.lead.count({ where: { orgId: org.id } });
  if (existingLeads === 0) {
    const reps = [owner.id, manager.id, sales.id];
    const companyNames = [
      "Northwind Traders",
      "Globex Corporation",
      "Initech",
      "Umbrella Retail",
      "Hooli",
      "Soylent Foods",
    ];
    const companies = [];
    for (let i = 0; i < companyNames.length; i++) {
      companies.push(
        await prisma.company.create({
          data: {
            orgId: org.id,
            name: companyNames[i],
            website: `https://${companyNames[i].toLowerCase().replace(/\W+/g, "")}.example`,
            industry: ["Retail", "Software", "Manufacturing", "Logistics"][i % 4],
            size: ["11-50", "51-200", "201-500", "1000+"][i % 4],
            ownerId: reps[i % reps.length],
            tags: { connect: [{ id: tagByName["Enterprise"] }] },
          },
        }),
      );
    }

    for (let i = 0; i < 10; i++) {
      const company = companies[i % companies.length];
      await prisma.contact.create({
        data: {
          orgId: org.id,
          name: `Contact ${i + 1}`,
          title: ["Head of Ops", "CTO", "Procurement Lead", "Founder"][i % 4],
          email: `contact${i + 1}@${company.name.toLowerCase().replace(/\W+/g, "")}.example`,
          phone: `+1-555-01${String(i).padStart(2, "0")}`,
          companyId: company.id,
          ownerId: reps[i % reps.length],
          source: (["REFERRAL", "WEBSITE", "EMAIL"] as LeadSource[])[i % 3],
          tags: i % 3 === 0 ? { connect: [{ id: tagByName["VIP"] }] } : undefined,
        },
      });
    }

    const statuses: LeadStatus[] = [
      "NEW",
      "NEW",
      "CONTACTED",
      "CONTACTED",
      "QUALIFIED",
      "QUALIFIED",
      "PROPOSAL",
      "NEGOTIATION",
      "WON",
      "WON",
      "LOST",
      "UNQUALIFIED",
    ];
    const sources: LeadSource[] = [
      "WEBSITE",
      "WHATSAPP",
      "INSTAGRAM",
      "GOOGLE",
      "REFERRAL",
      "COLD_CALL",
      "EMAIL",
      "MANUAL",
    ];
    for (let i = 0; i < 15; i++) {
      const lead = await prisma.lead.create({
        data: {
          orgId: org.id,
          name: `Prospect ${i + 1}`,
          companyName: companyNames[i % companyNames.length],
          email: `prospect${i + 1}@example.com`,
          phone: `+1-555-02${String(i).padStart(2, "0")}`,
          source: sources[i % sources.length],
          status: statuses[i % statuses.length],
          industry: ["Retail", "Software", "Manufacturing"][i % 3],
          location: ["Austin, TX", "Berlin", "Bangalore", "Toronto"][i % 4],
          ownerId: i % 4 === 3 ? null : reps[i % reps.length],
          estimatedValue: new Prisma.Decimal((i + 1) * 1500),
          nextFollowUpAt:
            i % 3 === 0 ? new Date(Date.now() + (i + 1) * 86_400_000) : null,
          tags:
            i % 2 === 0
              ? { connect: [{ id: tagByName["Hot Lead"] }] }
              : { connect: [{ id: tagByName["Follow Up"] }] },
        },
      });
      if (i % 4 === 0) {
        await prisma.activity.create({
          data: {
            orgId: org.id,
            type: "CALL",
            source: "MANUAL",
            subject: "Discovery call",
            body: "Initial discovery call booked. Budget confirmed.",
            createdById: reps[i % reps.length],
            leadId: lead.id,
          },
        });
      }
    }
    console.log("Seeded 6 companies, 10 contacts, 15 leads, 7 tags.");
  }

  // --- Sales Pipeline sample data (Phase 3) ------------------------------
  const dealCount = await prisma.deal.count({ where: { orgId: org.id } });
  if (dealCount === 0) {
    const reps = [owner.id, manager.id, sales.id];
    const companies = await prisma.company.findMany({
      where: { orgId: org.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    if (companies.length === 0) {
      console.log("No companies to attach deals to — skipping sales seed.");
    } else {
      const pipeline = await prisma.pipeline.create({
        data: { orgId: org.id, name: "Sales pipeline", isDefault: true, position: 0 },
      });
    const stageDefs: [string, number, "OPEN" | "WON" | "LOST"][] = [
      ["Qualified", 10, "OPEN"],
      ["Discovery", 30, "OPEN"],
      ["Proposal", 60, "OPEN"],
      ["Negotiation", 80, "OPEN"],
      ["Won", 100, "WON"],
      ["Lost", 0, "LOST"],
    ];
    const stages = [];
    for (let i = 0; i < stageDefs.length; i++) {
      const [name, probability, kind] = stageDefs[i];
      stages.push(
        await prisma.pipelineStage.create({
          data: { orgId: org.id, pipelineId: pipeline.id, name, probability, kind, position: i },
        }),
      );
    }

    const dealContacts = await prisma.contact.findMany({
      where: { orgId: org.id },
      select: { id: true, companyId: true },
    });
    for (let i = 0; i < 8; i++) {
      const stage = stages[i % stages.length];
      const company = companies[i % companies.length];
      const contact = dealContacts.find((c) => c.companyId === company.id);
      const deal = await prisma.deal.create({
        data: {
          orgId: org.id,
          name: `${company.name} — ${["Platform rollout", "Renewal", "Expansion", "Pilot"][i % 4]}`,
          pipelineId: pipeline.id,
          stageId: stage.id,
          status: stage.kind === "WON" ? "WON" : stage.kind === "LOST" ? "LOST" : "OPEN",
          probability: stage.probability,
          closedAt: stage.kind === "OPEN" ? null : new Date(),
          companyId: company.id,
          contactId: contact?.id ?? null,
          ownerId: reps[i % reps.length],
          value: new Prisma.Decimal((i + 2) * 8000),
          currency: "USD",
          expectedCloseDate: new Date(Date.now() + (i + 3) * 86_400_000),
          tags: { connect: [{ id: tagByName["High Value"] }] },
        },
      });
      await prisma.activity.create({
        data: {
          orgId: org.id,
          type: "NOTE",
          source: "SYSTEM",
          subject: `Deal created in stage “${stage.name}”`,
          createdById: reps[i % reps.length],
          dealId: deal.id,
        },
      });
      if (i % 2 === 0) {
        await prisma.task.create({
          data: {
            orgId: org.id,
            title: `Send proposal to ${company.name}`,
            status: "TODO",
            priority: (["MEDIUM", "HIGH", "URGENT"] as const)[i % 3],
            dueAt: new Date(Date.now() + (i + 1) * 86_400_000),
            assigneeId: reps[i % reps.length],
            createdById: owner.id,
            dealId: deal.id,
          },
        });
      }
    }

      // A few standalone / overdue tasks.
      await prisma.task.create({
        data: {
          orgId: org.id,
          title: "Follow up with unassigned leads",
          status: "TODO",
          priority: "HIGH",
          dueAt: new Date(Date.now() - 2 * 86_400_000),
          assigneeId: sales.id,
          createdById: manager.id,
        },
      });

      console.log("Seeded 1 pipeline (6 stages), 8 deals, ~6 tasks, deal activities.");
    }
  }

  console.log("\nSeed complete. All accounts use password:", DEMO_PASSWORD);
  console.table([
    { email: superAdmin.email, role: "SUPER ADMIN (platform)" },
    { email: owner.email, role: "OWNER of Acme Inc." },
    { email: manager.email, role: "MANAGER of Acme Inc." },
    { email: sales.email, role: "SALES of Acme Inc." },
    { email: viewer.email, role: "VIEWER of Acme Inc." },
  ]);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
