"use server";

import { db } from "@/lib/prisma";
import { generateWithOpenAI } from "@/lib/openai";
import { getOrCreateDbUser } from "./user";

export async function generateCoverLetter(data) {
  const user = await getOrCreateDbUser();

  const prompt = `
    Write a professional cover letter for a ${data.jobTitle} position at ${data.companyName}.

    About the candidate:
    - Industry: ${user.industry}
    - Years of Experience: ${user.experience}
    - Skills: ${user.skills?.join(", ")}
    - Professional Background: ${user.bio}

    Job Description:
    ${data.jobDescription}

    Requirements:
    1. Use a professional, enthusiastic tone
    2. Highlight relevant skills and experience
    3. Show understanding of the company's needs
    4. Keep it concise (max 400 words)
    5. Use proper business letter formatting in markdown
    6. Include specific examples of achievements
    7. Relate candidate's background to job requirements

    Format the letter in markdown.
  `;

  try {
    const content = await generateWithOpenAI(prompt);

    const coverLetter = await db.coverLetter.create({
      data: {
        content,
        jobDescription: data.jobDescription,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        status: "completed",
        userId: user.id,
      },
    });

    return coverLetter;
  } catch (error) {
    console.error("Error generating cover letter:", error?.message || error);

    // Detect quota / rate limit errors and gracefully fallback to a template
    const status = error?.status || error?.response?.status;
    const message = String(error?.message || error?.toString() || "").toLowerCase();

    const isQuota = status === 429 || /quota|rate limit|exceeded/i.test(message);

    const makeFallback = () => {
      const name = user?.name || "Candidate";
      const industry = user?.industry ? user.industry.replace(/^tech-/, "").replace(/-/g, " ") : "your field";
      const years = typeof user?.experience === "number" ? user.experience : user?.experience || "several";

      return `Dear Hiring Manager at ${data.companyName},\n\n` +
        `I am ${name}, a ${industry} professional with ${years} years of experience. I am excited to apply for the ${data.jobTitle} role at ${data.companyName}. ${user?.bio ? `My background includes ${user.bio}. ` : ""}` +
        `I have experience working on projects that required strong technical skills and collaboration, and I am confident I can contribute to your team's success.\n\n` +
        `I look forward to the opportunity to discuss how my background and skills align with ${data.companyName}'s needs.\n\n` +
        `Sincerely,\n${name}`;
    };

    if (isQuota) {
      try {
        const fallbackContent = makeFallback();

        const coverLetter = await db.coverLetter.create({
          data: {
            content: fallbackContent,
            jobDescription: data.jobDescription,
            companyName: data.companyName,
            jobTitle: data.jobTitle,
            status: "fallback",
            userId: user.id,
          },
        });

        console.warn("Used fallback cover letter due to quota/rate limit.");
        return coverLetter;
      } catch (saveError) {
        console.error("Failed to save fallback cover letter:", saveError?.message || saveError);
        throw new Error("Failed to generate cover letter");
      }
    }

    // For other errors, rethrow a helpful message
    throw new Error(error?.message || "Failed to generate cover letter");
  }
}

export async function getCoverLetters() {
  const user = await getOrCreateDbUser();

  return await db.coverLetter.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCoverLetter(id) {
  const user = await getOrCreateDbUser();

  return await db.coverLetter.findUnique({
    where: { id, userId: user.id },
  });
}

export async function deleteCoverLetter(id) {
  const user = await getOrCreateDbUser();

  return await db.coverLetter.delete({
    where: { id, userId: user.id },
  });
}