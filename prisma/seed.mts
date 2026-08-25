import "dotenv/config";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const raw = process.env.DATABASE_URL ?? "";
const p = raw.startsWith("file:") ? raw.slice(5) : raw;
const adapter = new PrismaBetterSqlite3({
  url: path.isAbsolute(p) ? p : path.resolve(process.cwd(), p),
});
const prisma = new PrismaClient({ adapter });

const email = "demo@shajaratna.app";

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.log("Demo data already exists. Delete prisma/dev.db to re-seed.");
  process.exit(0);
}

const user = await prisma.user.create({
  data: { name: "Demo User", email },
});

const family = await prisma.family.create({
  data: {
    name: "The Demo Family",
    description: "A sample family to explore the app.",
    inviteCode: "DEMO1234",
    createdById: user.id,
    memberships: { create: { userId: user.id, role: "OWNER" } },
  },
});

async function person(data: {
  firstName: string;
  lastName?: string;
  gender: string;
  birthDate?: string;
  deathDate?: string;
  isDeceased?: boolean;
  isRoot?: boolean;
  birthPlace?: string;
  occupation?: string;
  fatherId?: string;
  motherId?: string;
}) {
  return prisma.person.create({
    data: { ...data, familyId: family.id, createdById: user.id },
  });
}

// Gen 0
const grandpa = await person({
  firstName: "Ibrahim", lastName: "Al-Demo", gender: "MALE",
  birthDate: "1938", deathDate: "2015", isDeceased: true, isRoot: true,
  birthPlace: "Cairo", occupation: "Teacher",
});
const grandma = await person({
  firstName: "Amina", lastName: "Hassan", gender: "FEMALE",
  birthDate: "1942", isDeceased: false, birthPlace: "Alexandria", occupation: "Homemaker",
});
await prisma.spouseLink.create({ data: { aId: grandpa.id, bId: grandma.id } });

// Gen 1
const father = await person({
  firstName: "Mohamed", lastName: "Ibrahim", gender: "MALE",
  birthDate: "1965", fatherId: grandpa.id, motherId: grandma.id,
  occupation: "Engineer", birthPlace: "Cairo",
});
await person({
  firstName: "Salma", lastName: "Ibrahim", gender: "FEMALE",
  birthDate: "1968", fatherId: grandpa.id, motherId: grandma.id,
  occupation: "Doctor",
});
const uncle = await person({
  firstName: "Karim", lastName: "Ibrahim", gender: "MALE",
  birthDate: "1972", fatherId: grandpa.id, motherId: grandma.id,
  occupation: "Merchant",
});
const mother = await person({
  firstName: "Fatma", lastName: "Mostafa", gender: "FEMALE",
  birthDate: "1967", occupation: "Pharmacist",
});
await prisma.spouseLink.create({ data: { aId: father.id, bId: mother.id } });
const uncleWife = await person({
  firstName: "Nour", lastName: "Saeed", gender: "FEMALE", birthDate: "1975",
});
await prisma.spouseLink.create({ data: { aId: uncle.id, bId: uncleWife.id } });

// Gen 2
await person({
  firstName: "Omar", lastName: "Mohamed", gender: "MALE",
  birthDate: "1992", fatherId: father.id, motherId: mother.id,
  occupation: "Software Developer",
});
await person({
  firstName: "Layla", lastName: "Mohamed", gender: "FEMALE",
  birthDate: "1995", fatherId: father.id, motherId: mother.id,
});
await person({
  firstName: "Youssef", lastName: "Karim", gender: "MALE",
  birthDate: "2000", fatherId: uncle.id, motherId: uncleWife.id,
});

await prisma.comment.createMany({
  data: [
    {
      personId: grandpa.id, userId: user.id,
      text: "Does anyone have a photo of grandpa Ibrahim from his teaching days? I only have one from the 80s!",
    },
    {
      personId: grandpa.id, userId: user.id,
      text: "His exact birth date would be great too — we only know the year.",
    },
  ],
});

console.log("Seeded:");
console.log("  Family:", family.name, "| invite code:", family.inviteCode);
console.log("  Persons:", await prisma.person.count({ where: { familyId: family.id } }));
console.log("  Demo login email:", email);
