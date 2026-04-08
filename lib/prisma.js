import { Pool } from "@neondatabase/serverless";
import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const globalForDb = globalThis;

function readEnvFileDatabaseUrl() {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), envFile);
    if (!fs.existsSync(envPath)) continue;

    const parsed = dotenv.parse(fs.readFileSync(envPath));
    const fileUrl = parsed.DATABASE_URL?.trim();
    if (fileUrl) return fileUrl;
  }

  return undefined;
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || readEnvFileDatabaseUrl();
}

function toJsonArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
}

function fromJsonArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    }
    return item;
  });
}

function pickSelectedRow(row, select) {
  if (!select) return row;

  return Object.entries(select).reduce((selected, [key, enabled]) => {
    if (enabled) selected[key] = row[key];
    return selected;
  }, {});
}

function createId() {
  return randomUUID();
}

function createPool() {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to Neon.");
  }

  return new Pool({ connectionString });
}

function createRepository(client) {
  const query = (text, values = []) => client.query(text, values);

  const queryOne = async (text, values = []) => {
    const result = await query(text, values);
    return result.rows[0] ?? null;
  };

  const industryInsight = {
    findUnique: async ({ where, select } = {}) => {
      const industry = where?.industry;
      if (!industry) return null;

      const row = await queryOne('SELECT * FROM "IndustryInsight" WHERE "industry" = $1 LIMIT 1', [industry]);
      if (!row) return null;

      const mapped = {
        ...row,
        salaryRanges: fromJsonArray(row.salaryRanges),
        topSkills: row.topSkills ?? [],
        keyTrends: row.keyTrends ?? [],
        recommendedSkills: row.recommendedSkills ?? [],
      };

      return pickSelectedRow(mapped, select);
    },
    create: async ({ data }) => {
      return await queryOne(
        `INSERT INTO "IndustryInsight" (
          "id", "industry", "salaryRanges", "growthRate", "demandLevel", "topSkills", "marketOutlook", "keyTrends", "recommendedSkills", "lastUpdated", "nextUpdate"
        ) VALUES ($1, $2, $3::jsonb[], $4, $5, $6::text[], $7, $8::text[], $9::text[], COALESCE($10, NOW()), $11)
        RETURNING *`,
        [
          data.id ?? createId(),
          data.industry,
          toJsonArray(data.salaryRanges ?? []),
          data.growthRate,
          data.demandLevel,
          data.topSkills ?? [],
          data.marketOutlook,
          data.keyTrends ?? [],
          data.recommendedSkills ?? [],
          data.lastUpdated ?? null,
          data.nextUpdate,
        ]
      );
    },
    update: async ({ where, data }) => {
      const industry = where?.industry;
      if (!industry) throw new Error('IndustryInsight update requires `where.industry`.');

      const fields = [];
      const values = [];
      const addField = (column, value, cast = "") => {
        values.push(value);
        fields.push(`"${column}" = $${values.length}${cast}`);
      };

      if ("salaryRanges" in data) addField("salaryRanges", toJsonArray(data.salaryRanges ?? []), "::jsonb[]");
      if ("growthRate" in data) addField("growthRate", data.growthRate);
      if ("demandLevel" in data) addField("demandLevel", data.demandLevel);
      if ("topSkills" in data) addField("topSkills", data.topSkills ?? [], "::text[]");
      if ("marketOutlook" in data) addField("marketOutlook", data.marketOutlook);
      if ("keyTrends" in data) addField("keyTrends", data.keyTrends ?? [], "::text[]");
      if ("recommendedSkills" in data) addField("recommendedSkills", data.recommendedSkills ?? [], "::text[]");
      if ("lastUpdated" in data) addField("lastUpdated", data.lastUpdated);
      if ("nextUpdate" in data) addField("nextUpdate", data.nextUpdate);

      values.push(industry);
      fields.push('"lastUpdated" = NOW()');

      return await queryOne(`UPDATE "IndustryInsight" SET ${fields.join(", ")} WHERE "industry" = $${values.length} RETURNING *`, values);
    },
    findMany: async ({ select } = {}) => {
      const rows = await query('SELECT * FROM "IndustryInsight"');
      const mapped = rows.rows.map((row) => ({
        ...row,
        salaryRanges: fromJsonArray(row.salaryRanges),
        topSkills: row.topSkills ?? [],
        keyTrends: row.keyTrends ?? [],
        recommendedSkills: row.recommendedSkills ?? [],
      }));
      return select ? mapped.map((row) => pickSelectedRow(row, select)) : mapped;
    },
  };

  const user = {
    findUnique: async ({ where, select, include } = {}) => {
      const [key] = Object.keys(where || {});
      if (!key) return null;

      const row = await queryOne(`SELECT * FROM "User" WHERE "${key}" = $1 LIMIT 1`, [where[key]]);
      if (!row) return null;

      const selected = pickSelectedRow(row, select);

      if (include?.industryInsight) {
        const insight = row.industry
          ? await industryInsight.findUnique({ where: { industry: row.industry } })
          : null;
        return { ...selected, industryInsight: insight };
      }

      return selected;
    },
    create: async ({ data }) => {
      return await queryOne(
        `INSERT INTO "User" ("id", "clerkUserId", "email", "name", "imageUrl", "industry", "bio", "experience", "skills", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], NOW())
         RETURNING *`,
        [
          data.id ?? createId(),
          data.clerkUserId,
          data.email,
          data.name ?? null,
          data.imageUrl ?? null,
          data.industry ?? null,
          data.bio ?? null,
          data.experience ?? null,
          data.skills ?? [],
        ]
      );
    },
    update: async ({ where, data }) => {
      const id = where.id ?? where.clerkUserId;
      if (!id) throw new Error("User update requires `id` or `clerkUserId`.");

      const fields = [];
      const values = [];
      const addField = (column, value, cast = "") => {
        values.push(value);
        fields.push(`"${column}" = $${values.length}${cast}`);
      };

      if ("clerkUserId" in data) addField("clerkUserId", data.clerkUserId);
      if ("email" in data) addField("email", data.email);
      if ("name" in data) addField("name", data.name);
      if ("imageUrl" in data) addField("imageUrl", data.imageUrl);
      if ("industry" in data) addField("industry", data.industry);
      if ("bio" in data) addField("bio", data.bio);
      if ("experience" in data) addField("experience", data.experience);
      if ("skills" in data) addField("skills", data.skills ?? [], "::text[]");
      fields.push('"updatedAt" = NOW()');

      if (!fields.length) {
        return await queryOne('SELECT * FROM "User" WHERE "id" = $1 LIMIT 1', [id]);
      }

      values.push(id);
      return await queryOne(`UPDATE "User" SET ${fields.join(", ")} WHERE "id" = $${values.length} RETURNING *`, values);
    },
  };

  const resume = {
    findUnique: async ({ where } = {}) => {
      const userId = where?.userId;
      if (!userId) return null;
      return await queryOne('SELECT * FROM "Resume" WHERE "userId" = $1 LIMIT 1', [userId]);
    },
    upsert: async ({ where, update, create }) => {
      const userId = where?.userId;
      if (!userId) throw new Error("Resume upsert requires `where.userId`.");

      const updated = await queryOne(
        `UPDATE "Resume" SET "content" = $1, "atsScore" = COALESCE($2, "atsScore"), "feedback" = COALESCE($3, "feedback"), "updatedAt" = NOW() WHERE "userId" = $4 RETURNING *`,
        [update.content ?? create.content, update.atsScore ?? null, update.feedback ?? null, userId]
      );
      if (updated) return updated;

      return await queryOne(
        `INSERT INTO "Resume" ("id", "userId", "content", "atsScore", "feedback", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [create.id ?? createId(), userId, create.content, create.atsScore ?? null, create.feedback ?? null]
      );
    },
  };

  const coverLetter = {
    create: async ({ data }) => {
      return await queryOne(
        `INSERT INTO "CoverLetter" ("id", "userId", "content", "jobDescription", "companyName", "jobTitle", "status", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          data.id ?? createId(),
          data.userId,
          data.content,
          data.jobDescription ?? null,
          data.companyName,
          data.jobTitle,
          data.status ?? "draft",
        ]
      );
    },
    findMany: async ({ where, orderBy } = {}) => {
      const userId = where?.userId;
      const sortDir = orderBy?.createdAt?.toLowerCase() === "asc" ? "ASC" : "DESC";
      const result = await query(
        `SELECT * FROM "CoverLetter" WHERE "userId" = $1 ORDER BY "createdAt" ${sortDir}`,
        [userId]
      );
      return result.rows;
    },
    findUnique: async ({ where } = {}) => {
      const values = [];
      const clauses = [];
      if (where?.id) {
        values.push(where.id);
        clauses.push(`"id" = $${values.length}`);
      }
      if (where?.userId) {
        values.push(where.userId);
        clauses.push(`"userId" = $${values.length}`);
      }
      if (!clauses.length) return null;

      return await queryOne(`SELECT * FROM "CoverLetter" WHERE ${clauses.join(" AND ")} LIMIT 1`, values);
    },
    delete: async ({ where } = {}) => {
      const values = [];
      const clauses = [];
      if (where?.id) {
        values.push(where.id);
        clauses.push(`"id" = $${values.length}`);
      }
      if (where?.userId) {
        values.push(where.userId);
        clauses.push(`"userId" = $${values.length}`);
      }
      if (!clauses.length) throw new Error("CoverLetter delete requires an `id` and/or `userId`.");

      return await queryOne(`DELETE FROM "CoverLetter" WHERE ${clauses.join(" AND ")} RETURNING *`, values);
    },
  };

  const assessment = {
    create: async ({ data }) => {
      return await queryOne(
        `INSERT INTO "Assessment" ("id", "userId", "quizScore", "questions", "category", "improvementTip", "updatedAt")
         VALUES ($1, $2, $3, $4::jsonb[], $5, $6, NOW())
         RETURNING *`,
        [
          data.id ?? createId(),
          data.userId,
          data.quizScore,
          toJsonArray(data.questions ?? []),
          data.category,
          data.improvementTip ?? null,
        ]
      );
    },
    findMany: async ({ where, orderBy } = {}) => {
      const userId = where?.userId;
      const sortDir = orderBy?.createdAt?.toLowerCase() === "desc" ? "DESC" : "ASC";
      const result = await query(
        `SELECT * FROM "Assessment" WHERE "userId" = $1 ORDER BY "createdAt" ${sortDir}`,
        [userId]
      );
      return result.rows.map((row) => ({
        ...row,
        questions: fromJsonArray(row.questions),
      }));
    },
  };

  return {
    user,
    industryInsight,
    resume,
    coverLetter,
    assessment,
    $transaction: async (fn) => {
      const txClient = await pool.connect();
      try {
        await txClient.query("BEGIN");
        const tx = createRepository(txClient);
        const result = await fn(tx);
        await txClient.query("COMMIT");
        return result;
      } catch (error) {
        await txClient.query("ROLLBACK");
        throw error;
      } finally {
        txClient.release();
      }
    },
  };
}

const pool = globalForDb.pool ?? createPool();

export const db = globalForDb.db ?? createRepository(pool);

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.db = db;
}
