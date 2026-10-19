import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  {
    code: "DEPT_CREDIT",
    name: "Credit & Bureau Support",
    description:
      "Handles credit reporting disputes, inaccurate personal reports, and credit bureau investigations.",
  },
  {
    code: "DEPT_COLLECTIONS",
    name: "Collections & Dispute Support",
    description:
      "Handles debt validation disputes, collection agency inquiries, and communication protocol compliance.",
  },
  {
    code: "DEPT_LOANS",
    name: "Loan & Mortgage Servicing",
    description:
      "Handles mortgage escrow disputes, consumer loan servicing, interest calculations, and deed releases.",
  },
  {
    code: "DEPT_CARDS",
    name: "Card Services & Billing",
    description:
      "Handles credit and prepaid card unauthorized charges, dispute processing, and billing adjustments.",
  },
  {
    code: "DEPT_BANKING",
    name: "Banking Operations",
    description:
      "Handles retail checking/savings accounts, wire transfers, deposit holds, and debit transactions.",
  },
  {
    code: "DEPT_GENERAL",
    name: "General Customer Support",
    description:
      "General customer inquiries, cross-functional triage, and unclassified consumer concerns.",
  },
];

const INITIAL_USERS = [
  {
    email: "admin@complaint-intel.org",
    fullName: "System Administrator",
    role: UserRole.ADMIN,
    password: process.env.ADMIN_INITIAL_PASSWORD || "Admin#Intel2026!",
    deptCode: "DEPT_GENERAL",
  },
  {
    email: "supervisor@complaint-intel.org",
    fullName: "Support Operations Supervisor",
    role: UserRole.MANAGER,
    password: process.env.SUPERVISOR_INITIAL_PASSWORD || "Supervisor#Intel2026!",
    deptCode: "DEPT_GENERAL",
  },
  {
    email: "agent.cards@complaint-intel.org",
    fullName: "Card Dispute Specialist",
    role: UserRole.AGENT,
    password: process.env.AGENT_INITIAL_PASSWORD || "Agent#Intel2026!",
    deptCode: "DEPT_CARDS",
  },
  {
    email: "agent.disputes@complaint-intel.org",
    fullName: "Credit Reporting Specialist",
    role: UserRole.AGENT,
    password: process.env.AGENT_INITIAL_PASSWORD || "Agent#Intel2026!",
    deptCode: "DEPT_CREDIT",
  },
  {
    email: "auditor@complaint-intel.org",
    fullName: "Compliance & Audit Officer",
    role: UserRole.AUDITOR,
    password: process.env.AUDITOR_INITIAL_PASSWORD || "Auditor#Intel2026!",
    deptCode: "DEPT_GENERAL",
  },
];

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  if (
    !process.env.ADMIN_INITIAL_PASSWORD ||
    !process.env.SUPERVISOR_INITIAL_PASSWORD ||
    !process.env.AGENT_INITIAL_PASSWORD ||
    !process.env.AUDITOR_INITIAL_PASSWORD
  ) {
    throw new Error(
      "❌ [Security Error] In production mode, ADMIN_INITIAL_PASSWORD, SUPERVISOR_INITIAL_PASSWORD, AGENT_INITIAL_PASSWORD, and AUDITOR_INITIAL_PASSWORD must be explicitly set via environment variables. Default credentials cannot be seeded into production.",
    );
  }
}

async function seed(): Promise<void> {
  console.log("🌱 [Phase 3 Seed] Seeding reference departments...");

  const deptMap = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: {
        name: dept.name,
        description: dept.description,
        isActive: true,
      },
      create: {
        code: dept.code,
        name: dept.name,
        description: dept.description,
        isActive: true,
      },
    });
    deptMap.set(dept.code, record.id);
  }
  console.log(`✅ Seeded ${DEPARTMENTS.length} canonical departments successfully.`);

  console.log("🔐 [Phase 3 Seed] Seeding RBAC users...");
  for (const user of INITIAL_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const departmentId = deptMap.get(user.deptCode) || null;

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        departmentId,
        isActive: true,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        departmentId,
        isActive: true,
      },
    });
    console.log(`  - Configured user: ${user.email} [${user.role}]`);
  }
  console.log(`✅ Seeded ${INITIAL_USERS.length} RBAC users successfully.`);

  // Enrich existing verified resolutions with Phase 3 Provenance metadata
  console.log("📚 [Phase 3 Seed] Enriching resolution knowledge base provenance...");
  const verifiedKbPath = path.resolve(process.cwd(), "data/resolutions/verified_resolutions_kb.json");
  if (fs.existsSync(verifiedKbPath)) {
    const rawData = fs.readFileSync(verifiedKbPath, "utf-8");
    const playbooks = JSON.parse(rawData);

    let enrichedCount = 0;
    for (const pb of playbooks) {
      const existing = await prisma.resolution.findUnique({
        where: { referenceCode: pb.reference_code },
        select: { id: true },
      });

      if (existing) {
        const provenance = pb.provenance || {};
        await prisma.resolution.update({
          where: { referenceCode: pb.reference_code },
          data: {
            sourceTitle: pb.title || "Regulatory SOP Playbook",
            sourceUrl: "https://www.consumerfinance.gov/rules-policy/regulations/",
            sourceOrg: provenance.authority ? "CFPB / Federal Banking Regulators" : "Consumer Financial Protection Bureau",
            contentType: "REGULATORY_PLAYBOOK",
            version: provenance.playbook_version || "2026.1",
            lastVerifiedAt: new Date("2026-10-16T00:00:00Z"),
            verificationStatus: "VERIFIED",
            isVerified: true,
          },
        });
        enrichedCount++;
      }
    }
    console.log(`✅ Enriched ${enrichedCount} verified playbooks with legal provenance.`);
  }
}

seed()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
