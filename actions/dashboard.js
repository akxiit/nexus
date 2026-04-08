"use server";

import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrCreateDbUser } from "./user";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const DEFAULT_SALARY_RANGES = [
  { role: "Junior Professional", min: 45000, max: 70000, median: 56000, location: "Global" },
  { role: "Mid-level Professional", min: 70000, max: 110000, median: 88000, location: "Global" },
  { role: "Senior Professional", min: 110000, max: 165000, median: 134000, location: "Global" },
  { role: "Lead Specialist", min: 130000, max: 190000, median: 156000, location: "Global" },
  { role: "Manager", min: 120000, max: 200000, median: 160000, location: "Global" },
];

const DEFAULT_INSIGHTS = {
  salaryRanges: DEFAULT_SALARY_RANGES,
  growthRate: 8,
  demandLevel: "Medium",
  topSkills: ["Communication", "Problem Solving", "Collaboration", "Data Literacy", "Leadership"],
  marketOutlook: "Neutral",
  keyTrends: [
    "Increased AI adoption",
    "Remote collaboration tooling",
    "Data-driven decisions",
    "Focus on automation",
    "Cross-functional teams",
  ],
  recommendedSkills: ["AI fundamentals", "Cloud basics", "Stakeholder management", "Agile delivery", "Analytics"],
};

function sanitizeList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return items.length ? items.slice(0, 10) : fallback;
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeSalaryRanges(value) {
  if (!Array.isArray(value) || !value.length) return DEFAULT_SALARY_RANGES;

  const ranges = value
    .map((range, index) => {
      const min = Math.max(0, toNumber(range?.min, 0));
      const max = Math.max(min, toNumber(range?.max, min));
      const median = Math.min(max, Math.max(min, toNumber(range?.median, (min + max) / 2)));

      return {
        role: String(range?.role ?? `Role ${index + 1}`).trim() || `Role ${index + 1}`,
        min,
        max,
        median,
        location: String(range?.location ?? "Global").trim() || "Global",
      };
    })
    .slice(0, 8);

  return ranges.length >= 3 ? ranges : DEFAULT_SALARY_RANGES;
}

function normalizeInsightPayload(payload = {}) {
  const demand = String(payload.demandLevel ?? DEFAULT_INSIGHTS.demandLevel).toLowerCase();
  const outlook = String(payload.marketOutlook ?? DEFAULT_INSIGHTS.marketOutlook).toLowerCase();

  return {
    salaryRanges: normalizeSalaryRanges(payload.salaryRanges),
    growthRate: Math.max(0, Math.min(100, toNumber(payload.growthRate, DEFAULT_INSIGHTS.growthRate))),
    demandLevel: demand === "high" || demand === "medium" || demand === "low"
      ? demand.charAt(0).toUpperCase() + demand.slice(1)
      : DEFAULT_INSIGHTS.demandLevel,
    topSkills: sanitizeList(payload.topSkills, DEFAULT_INSIGHTS.topSkills),
    marketOutlook: outlook === "positive" || outlook === "neutral" || outlook === "negative"
      ? outlook.charAt(0).toUpperCase() + outlook.slice(1)
      : DEFAULT_INSIGHTS.marketOutlook,
    keyTrends: sanitizeList(payload.keyTrends, DEFAULT_INSIGHTS.keyTrends),
    recommendedSkills: sanitizeList(payload.recommendedSkills, DEFAULT_INSIGHTS.recommendedSkills),
  };
}

export const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }

         IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return normalizeInsightPayload(JSON.parse(cleanedText));
  } catch (error) {
    console.warn(`Falling back to default industry insights for ${industry}:`, error?.message || error);
    return normalizeInsightPayload(DEFAULT_INSIGHTS);
  }
};

export async function getIndustryInsights() {
  const user = await getOrCreateDbUser();

  const userWithInsight = await db.user.findUnique({
    where: { clerkUserId: user.clerkUserId },
    include: { industryInsight: true },
  });

  if (!userWithInsight.industryInsight) {
    const insights = await generateAIInsights(userWithInsight.industry);

    let industryInsight;
    try {
      industryInsight = await db.industryInsight.create({
        data: {
          industry: userWithInsight.industry,
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (error?.code === "23505") {
        industryInsight = await db.industryInsight.findUnique({
          where: { industry: userWithInsight.industry },
        });
      } else {
        throw error;
      }
    }

    return industryInsight;
  }

  return userWithInsight.industryInsight;
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function getIndustrySkillSuggestions({ industryId, subIndustry, limit = 12 } = {}) {
  if (!industryId || !subIndustry) return [];

  const industryKey = `${industryId}-${slugify(subIndustry)}`;

  let insight = await db.industryInsight.findUnique({
    where: { industry: industryKey },
  });

  if (!insight) {
    const insights = await generateAIInsights(industryKey);

    try {
      insight = await db.industryInsight.create({
        data: {
          industry: industryKey,
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (error?.code === "23505") {
        insight = await db.industryInsight.findUnique({
          where: { industry: industryKey },
        });
      } else {
        throw error;
      }
    }
  }

  const mergedSkills = [
    ...(insight?.topSkills ?? []),
    ...(insight?.recommendedSkills ?? []),
  ];

  const dedupedSkills = [...new Set(mergedSkills.map((skill) => String(skill || "").trim()).filter(Boolean))];
  return dedupedSkills.slice(0, limit);
}