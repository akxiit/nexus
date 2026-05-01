"use server";

import { db } from "@/lib/prisma";
import { generateWithOpenAI } from "@/lib/openai";
import { revalidatePath } from "next/cache";
import { getOrCreateDbUser } from "./user";

export async function saveResume(content) {
  const user = await getOrCreateDbUser();

  try {
    const resume = await db.resume.upsert({
      where: { userId: user.id },
      update: { content },
      create: { userId: user.id, content },
    });

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const user = await getOrCreateDbUser();

  return await db.resume.findUnique({
    where: { userId: user.id },
  });
}

function extractSkillsFromResumeContent(content) {
  const text = String(content || "");
  if (!text.trim()) return [];

  const skillsSectionMatch = text.match(/##\s*Skills\s*\n+([\s\S]*?)(?=\n##\s|$)/i);
  const skillsBlock = skillsSectionMatch?.[1] || "";

  return [...new Set(
    skillsBlock
      .split(/[\n,•;|]/)
      .map((skill) => skill.trim())
      .map((skill) => skill.replace(/^[-*\d.]+\s*/, ""))
      .filter(Boolean)
  )];
}

export async function getResumeSkills() {
  const resume = await getResume();
  return extractSkillsFromResumeContent(resume?.content);
}

export async function improveWithAI({ current, type }) {
  const user = await getOrCreateDbUser();

  const prompt = `
    As an expert resume writer, improve the following ${type} description for a ${user.industry || "technology"} professional.
    Make it more impactful, quantifiable, and aligned with industry standards.
    Current content: "${current}"

    Requirements:
    1. Use action verbs
    2. Include metrics and results where possible
    3. Highlight relevant technical skills
    4. Keep it concise but detailed
    5. Focus on achievements over responsibilities
    6. Use industry-specific keywords

    Format the response as a single paragraph without any additional text or explanations.
  `;

  try {
    const result = await generateWithOpenAI(prompt);
    return result.trim();
  } catch (error) {
    console.error("Error improving content:", error);
    throw new Error("Failed to improve content");
  }
}

export async function generateProfessionalSummary({ specialization, experience, skills }) {
  const normalizedSkills = Array.isArray(skills)
    ? skills.filter(Boolean).join(", ")
    : String(skills || "");

  const normalizedExperience = Array.isArray(experience)
    ? experience.filter(Boolean).join("; ")
    : String(experience || "");

  const prompt = `
    Generate a concise professional resume summary based on:
    - Specialization/Role: ${specialization || "Technology professional"}
    - Experience: ${normalizedExperience || "relevant experience"}
    - Skills: ${normalizedSkills || "technical skills"}

    Create a compelling 3-5 sentence professional summary that:
    1. Highlights the user's specialization and years of experience
    2. Mentions the strongest skills and tools from the list above
    3. Sounds human, confident, and tailored to the role

    Return ONLY the summary text, no markdown formatting or explanations.
  `;

  try {
    const generated = await generateWithOpenAI(prompt);

    if (generated) {
      return generated;
    }

    throw new Error("Empty summary response");
  } catch (error) {
    console.error("Error generating summary:", error);

    const summarySpecialization = specialization || "Technology professional";
    const summarySkills = normalizedSkills || "relevant tools and technologies";
    const summaryExperience = normalizedExperience || "practical experience";

    return `${summarySpecialization} with ${summaryExperience} and a strong focus on ${summarySkills}. Known for delivering practical, high-quality work, collaborating effectively, and adapting quickly to new challenges. Seeking opportunities to apply core expertise to build reliable, impactful solutions.`;
  }
}