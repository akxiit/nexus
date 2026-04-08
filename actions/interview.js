"use server";

import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrCreateDbUser } from "./user";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function normalizeQuestionCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.max(10, Math.min(25, parsed));
}

function pickSkillContext({ selectedSkill, mixedMode, skills }) {
  if (mixedMode && skills?.length) {
    return {
      label: "Mixed Skills",
      promptText: `across these skills: ${skills.join(", ")}`,
    };
  }

  if (selectedSkill) {
    return {
      label: selectedSkill,
      promptText: `focused on ${selectedSkill}`,
    };
  }

  if (skills?.length) {
    return {
      label: "General",
      promptText: `with emphasis on ${skills.slice(0, 5).join(", ")}`,
    };
  }

  return {
    label: "General",
    promptText: "with general industry fundamentals",
  };
}

function sanitizeQuizQuestions(rawQuestions = [], fallbackCount = 10) {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((question) => {
      const options = Array.isArray(question?.options)
        ? question.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
        : [];

      if (!question?.question || options.length < 2) return null;

      const correctAnswer = options.includes(question.correctAnswer)
        ? question.correctAnswer
        : options[0];

      return {
        question: String(question.question).trim(),
        options,
        correctAnswer,
        explanation: String(question?.explanation || "Review this concept and practice similar interview questions.").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, fallbackCount);
}

function tryParseQuizJson(text) {
  const cleaned = String(text || "").replace(/```(?:json)?\n?/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonSlice);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function buildFallbackQuestions({ questionCount, industry, selectedSkill, skills, mixedMode }) {
  const focus = mixedMode
    ? `across ${skills.length ? skills.join(", ") : "core"} skills`
    : selectedSkill || skills[0] || "core interview topics";

  const bank = [
    {
      question: `In ${industry || "your industry"}, what is the best first step to solve a new technical problem focused on ${focus}?`,
      options: [
        "Clarify requirements and constraints",
        "Start coding immediately",
        "Ignore edge cases",
        "Skip validation",
      ],
      correctAnswer: "Clarify requirements and constraints",
      explanation: "Strong interview answers begin with problem understanding, constraints, and success criteria.",
    },
    {
      question: `Which practice most improves reliability when implementing solutions for ${focus}?`,
      options: [
        "Write tests for key paths and edge cases",
        "Only test happy paths manually",
        "Avoid monitoring in production",
        "Skip code reviews",
      ],
      correctAnswer: "Write tests for key paths and edge cases",
      explanation: "Testing key flows and edge cases is foundational for correctness and reliability.",
    },
    {
      question: `When optimizing performance in ${industry || "technical"} systems, what should be done first?`,
      options: [
        "Measure and identify the bottleneck",
        "Refactor everything",
        "Add random caching",
        "Scale infrastructure blindly",
      ],
      correctAnswer: "Measure and identify the bottleneck",
      explanation: "You should profile first so optimization work targets the real bottleneck.",
    },
    {
      question: `What is the best way to explain trade-offs during an interview discussion about ${focus}?`,
      options: [
        "Compare alternatives with pros, cons, and constraints",
        "Claim one approach is always best",
        "Avoid discussing limitations",
        "Focus only on tools",
      ],
      correctAnswer: "Compare alternatives with pros, cons, and constraints",
      explanation: "Interviewers value structured reasoning and clear trade-off communication.",
    },
    {
      question: `For maintainable solutions in ${focus}, which approach is best?`,
      options: [
        "Use clear naming and modular design",
        "Use deeply nested logic everywhere",
        "Duplicate code for speed",
        "Avoid documentation",
      ],
      correctAnswer: "Use clear naming and modular design",
      explanation: "Readable, modular code reduces defects and accelerates future changes.",
    },
  ];

  const generated = [];
  for (let i = 0; i < questionCount; i++) {
    generated.push({ ...bank[i % bank.length] });
  }

  return generated;
}

export async function getQuizSetupData() {
  const user = await getOrCreateDbUser();

  const userProfile = await db.user.findUnique({
    where: { clerkUserId: user.clerkUserId },
    select: { skills: true, industry: true },
  });

  const skills = [...new Set((userProfile?.skills || []).map((skill) => String(skill).trim()).filter(Boolean))];

  return {
    industry: userProfile?.industry || null,
    skills,
  };
}

export async function generateQuiz(config = {}) {
  const user = await getOrCreateDbUser();

  const userProfile = await db.user.findUnique({
    where: { clerkUserId: user.clerkUserId },
    select: { industry: true, skills: true },
  });

  const questionCount = normalizeQuestionCount(config.questionCount);
  const profileSkills = [...new Set((userProfile?.skills || []).map((skill) => String(skill).trim()).filter(Boolean))];

  const chosenSkill = typeof config.selectedSkill === "string" ? config.selectedSkill.trim() : "";
  const selectedSkill = chosenSkill && profileSkills.includes(chosenSkill) ? chosenSkill : "";
  const mixedMode = config.quizMode === "mixed";
  const skillContext = pickSkillContext({ selectedSkill, mixedMode, skills: profileSkills });

  const prompt = `
    Generate ${questionCount} technical interview questions for a ${userProfile.industry} professional ${skillContext.promptText}.

    Each question should be multiple choice with 4 options.
    Return the response in this JSON format only, no additional text:
    {
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctAnswer": "string",
          "explanation": "string"
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const quiz = tryParseQuizJson(text);

    let questions = sanitizeQuizQuestions(quiz?.questions, questionCount);
    if (!questions.length) {
      questions = buildFallbackQuestions({
        questionCount,
        industry: userProfile?.industry,
        selectedSkill,
        skills: profileSkills,
        mixedMode,
      });
    }

    return {
      questions,
      metadata: {
        questionCount,
        quizMode: mixedMode ? "mixed" : "single",
        selectedSkill: selectedSkill || null,
        category: skillContext.label,
      },
    };
  } catch (error) {
    console.error("Error generating quiz, using fallback questions:", error);

    const questions = buildFallbackQuestions({
      questionCount,
      industry: userProfile?.industry,
      selectedSkill,
      skills: profileSkills,
      mixedMode,
    });

    return {
      questions,
      metadata: {
        questionCount,
        quizMode: mixedMode ? "mixed" : "single",
        selectedSkill: selectedSkill || null,
        category: skillContext.label,
      },
    };
  }
}

export async function saveQuizResult(questions, answers, score, metadata = {}) {
  const user = await getOrCreateDbUser();

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index],
    isCorrect: q.correctAnswer === answers[index],
    explanation: q.explanation,
  }));

  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  let improvementTip = null;
  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) => `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
      )
      .join("\n\n");

    const improvementPrompt = `
      The user got the following ${user.industry} technical interview questions wrong:

      ${wrongQuestionsText}

      Based on these mistakes, provide a concise, specific improvement tip.
      Focus on the knowledge gaps revealed by these wrong answers.
      Keep the response under 2 sentences and make it encouraging.
      Don't explicitly mention the mistakes, instead focus on what to learn/practice.
    `;

    try {
      const tipResult = await model.generateContent(improvementPrompt);
      improvementTip = tipResult.response.text().trim();
    } catch (error) {
      console.error("Error generating improvement tip:", error);
    }
  }

  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults,
        category: metadata?.category || "Technical",
        improvementTip,
      },
    });

    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

export async function getAssessments() {
  const user = await getOrCreateDbUser();

  try {
    const assessments = await db.assessment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}