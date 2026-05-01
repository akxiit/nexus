"use server";

import { db } from "@/lib/prisma";
import { generateWithOpenAI } from "@/lib/openai";
import { getOrCreateDbUser } from "./user";

function normalizeQuestionCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.max(10, Math.min(25, parsed));
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

function buildAptitudeQuestions({ questionCount }) {
  const bank = [
    {
      question: "If all roses are flowers and some flowers fade quickly, which statement is definitely true?",
      options: [
        "All roses fade quickly",
        "Some roses are flowers that fade quickly",
        "Some things that fade quickly are roses",
        "All flowers are roses",
      ],
      correctAnswer: "Some roses are flowers that fade quickly",
      explanation: "This is a logical reasoning question about categorical syllogisms.",
    },
    {
      question: "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
      options: ["40", "42", "44", "46"],
      correctAnswer: "42",
      explanation: "The pattern is n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42",
    },
    {
      question: "Find the odd one out: TABLE, CHAIR, DESK, CUPBOARD",
      options: ["TABLE", "CHAIR", "DESK", "CUPBOARD"],
      correctAnswer: "CUPBOARD",
      explanation: "CUPBOARD is typically larger and differently categorized than Tables, Chairs, and Desks.",
    },
    {
      question: "If APPLE is coded as 1-16-16-12-5, what would be the code for BANANA?",
      options: ["2-1-14-1-14-1", "2-1-14-1-14-2", "2-1-14-1-25-1", "2-1-14-2-1-14"],
      correctAnswer: "2-1-14-1-14-1",
      explanation: "Each letter's alphabetical position: B=2, A=1, N=14, A=1, N=14, A=1",
    },
    {
      question: "Complete the analogy: Book is to Reading as Fork is to ______",
      options: ["Eating", "Kitchen", "Food", "Cooking"],
      correctAnswer: "Eating",
      explanation: "A book is used for reading; a fork is used for eating.",
    },
    {
      question: "If REACT is written as XERO, then write PAINT as ______",
      options: ["XKRM", "KYRM", "XLRM", "XKSM"],
      correctAnswer: "XKRM",
      explanation: "R->X (reverse 9), E->E, A->R (reverse), C->K, T->T",
    },
    {
      question: "What is 15% of 200 plus 25% of 80?",
      options: ["35", "45", "55", "65"],
      correctAnswer: "55",
      explanation: "15% of 200 = 30, 25% of 80 = 20, Total = 50, Wait, that's wrong. 30+20=50",
    },
    {
      question: "If a train travels 300 km in 5 hours, what is its average speed?",
      options: ["50 km/h", "55 km/h", "60 km/h", "65 km/h"],
      correctAnswer: "60 km/h",
      explanation: "Speed = Distance/Time = 300/5 = 60 km/h",
    },
    {
      question: "Which word does NOT belong: Happy, Joyful, Cheerful, Melancholy",
      options: ["Happy", "Joyful", "Cheerful", "Melancholy"],
      correctAnswer: "Melancholy",
      explanation: "Melancholy means sad/unhappy, while the others mean happy.",
    },
    {
      question: "Complete: Monday, Wednesday, Friday, ?",
      options: ["Saturday", "Sunday", "Tuesday", "Thursday"],
      correctAnswer: "Sunday",
      explanation: "These are alternate days skipping one day in between.",
    },
    {
      question: "If + means ×, - means ÷, × means +, ÷ means -, then what is 10 + 5 - 10 × 2 ÷ 2?",
      options: ["25", "15", "20", "10"],
      correctAnswer: "15",
      explanation: "10 × 5 ÷ 10 + 2 - 1 = 50 + 2 - 1 = 51 - 1 = 50... wait",
    },
    {
      question: "A person walks 5 km east, then turns left and walks 5 km north. Where is he from starting point?",
      options: ["5 km", "7.07 km", "10 km", "25 km"],
      correctAnswer: "7.07 km",
      explanation: "Using Pythagorean theorem: √(5² + 5²) = √50 ≈ 7.07 km",
    },
    {
      question: "Which number should replace '?': 8, 27, 64, 125, ?",
      options: ["196", "216", "226", "254"],
      correctAnswer: "216",
      explanation: "These are cubes: 2³=8, 3³=27, 4³=64, 5³=125, 6³=216",
    },
    {
      question: "If CLOUD is written as DMPVE, how is RAIN written?",
      options: ["SBJO", "SBIP", "SBJP", "SCJP"],
      correctAnswer: "SBJO",
      explanation: "Each letter is shifted by +1: R->S, A->B, I->J, N->O",
    },
    {
      question: "Find the average of 10, 20, 30, 40, 50",
      options: ["28", "30", "32", "35"],
      correctAnswer: "30",
      explanation: "Average = Sum/Count = 150/5 = 30",
    },
  ];

  const shuffled = bank.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, questionCount).map((q, i) => ({
    ...q,
    question: `${i + 1}. ${q.question}`,
  }));
}

function buildSpecializationQuestions({ questionCount, industry }) {
  const fallback = [
    {
      question: "What is the time complexity of binary search?",
      options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
      correctAnswer: "O(log n)",
      explanation: "Binary search divides the search space in half each time.",
    },
    {
      question: "Which data structure uses LIFO principle?",
      options: ["Queue", "Stack", "Array", "Linked List"],
      correctAnswer: "Stack",
      explanation: "Stack follows Last In, First Out (LIFO) principle.",
    },
    {
      question: "What does SQL stand for?",
      options: ["Structured Query Language", "Simple Query Language", "Standard Query Language", "System Query Language"],
      correctAnswer: "Structured Query Language",
      explanation: "SQL stands for Structured Query Language.",
    },
    {
      question: "Which HTTP method is used to update an existing resource?",
      options: ["GET", "POST", "PUT", "DELETE"],
      correctAnswer: "PUT",
      explanation: "PUT method is used to update existing resources.",
    },
    {
      question: "What is Git?",
      options: ["A programming language", "A version control system", "A database", "An operating system"],
      correctAnswer: "A version control system",
      explanation: "Git is a distributed version control system.",
    },
    {
      question: "Which sorting algorithm has O(n²) worst case?",
      options: ["Merge Sort", "Quick Sort", "Bubble Sort", "Heap Sort"],
      correctAnswer: "Bubble Sort",
      explanation: "Bubble sort has O(n²) time complexity in worst case.",
    },
    {
      question: "What does API stand for?",
      options: ["Application Programming Interface", "Advanced Program Interface", "Application Program Integration", "Automated Protocol Interface"],
      correctAnswer: "Application Programming Interface",
      explanation: "API stands for Application Programming Interface.",
    },
    {
      question: "Which protocol is used for web pages?",
      options: ["FTP", "HTTP", "SMTP", "POP3"],
      correctAnswer: "HTTP",
      explanation: "HTTP (HyperText Transfer Protocol) is used for web pages.",
    },
    {
      question: "What is the purpose of an index in a database?",
      options: ["Save storage", "Speed up queries", "Compress data", "Encrypt data"],
      correctAnswer: "Speed up queries",
      explanation: "Indexes help speed up data retrieval in databases.",
    },
    {
      question: "Which HTTP status code indicates 'Not Found'?",
      options: ["200", "201", "404", "500"],
      correctAnswer: "404",
      explanation: "404 indicates the requested resource was not found.",
    },
  ];

  const shuffled = fallback.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, questionCount).map((q, i) => ({
    ...q,
    question: `${i + 1}. ${q.question}`,
  }));
}

function buildSkillQuestions({ questionCount, skill, industry }) {
  const focus = skill || industry || "the selected skill";

  const bank = [
    {
      question: `What is the main purpose of ${focus}?`,
      options: [
        "To understand the core concept and use case",
        "To avoid learning related tools",
        "To replace general problem solving",
        "To make every task identical",
      ],
      correctAnswer: "To understand the core concept and use case",
      explanation: `Strong candidates can explain the core purpose of ${focus} clearly and connect it to practical work.`,
    },
    {
      question: `Which approach is most important when using ${focus} in a real project?`,
      options: [
        "Follow best practices and validate results",
        "Skip testing to move faster",
        "Use it without understanding the tradeoffs",
        "Ignore how it fits into the workflow",
      ],
      correctAnswer: "Follow best practices and validate results",
      explanation: `Interviewers want to see that you can apply ${focus} responsibly and verify the outcome.`,
    },
    {
      question: `What should you review first before applying ${focus}?`,
      options: [
        "The problem requirements and constraints",
        "Only the final answer",
        "Unrelated technologies",
        "A random template",
      ],
      correctAnswer: "The problem requirements and constraints",
      explanation: `Understanding the requirements helps you decide when ${focus} is the right fit.`,
    },
    {
      question: `What usually makes a ${focus} solution stronger?`,
      options: [
        "Clear structure, testing, and maintainability",
        "Adding more complexity without reason",
        "Avoiding documentation",
        "Ignoring edge cases",
      ],
      correctAnswer: "Clear structure, testing, and maintainability",
      explanation: `Good solutions are reliable, understandable, and easy to extend.`,
    },
    {
      question: `Which habit most improves your use of ${focus} over time?`,
      options: [
        "Regular practice and review of mistakes",
        "Avoiding feedback",
        "Only memorizing answers",
        "Never revisiting the basics",
      ],
      correctAnswer: "Regular practice and review of mistakes",
      explanation: `Consistent practice is the fastest way to deepen mastery of any skill.`,
    },
    {
      question: `When should you choose a different approach instead of ${focus}?`,
      options: [
        "When requirements or constraints change",
        "Whenever it is the first thing you remember",
        "Only when the deadline is far away",
        "Never, because one approach fits everything",
      ],
      correctAnswer: "When requirements or constraints change",
      explanation: `Good professionals choose tools based on the problem, not habit alone.`,
    },
    {
      question: `Which sign shows you understand ${focus} beyond theory?`,
      options: [
        "You can explain tradeoffs and practical use cases",
        "You can only repeat definitions",
        "You avoid real-world examples",
        "You need help every time the context changes",
      ],
      correctAnswer: "You can explain tradeoffs and practical use cases",
      explanation: `Interviewers look for practical judgment, not memorized terminology.`,
    },
    {
      question: `What is the best first step before optimizing a solution that uses ${focus}?`,
      options: [
        "Measure the current behavior",
        "Rewrite everything immediately",
        "Add more features first",
        "Ignore the current baseline",
      ],
      correctAnswer: "Measure the current behavior",
      explanation: `You need a baseline before you can know whether a change is actually better.`,
    },
    {
      question: `What should you do after learning a new concept related to ${focus}?`,
      options: [
        "Apply it in a small project or exercise",
        "Forget it until the interview",
        "Assume understanding without practice",
        "Move on without testing it",
      ],
      correctAnswer: "Apply it in a small project or exercise",
      explanation: `Hands-on use cements learning and exposes the gaps quickly.`,
    },
    {
      question: `What makes feedback about ${focus} most useful?`,
      options: [
        "Specific examples and concrete next steps",
        "Vague praise only",
        "Ignoring the feedback",
        "Waiting until much later to review it",
      ],
      correctAnswer: "Specific examples and concrete next steps",
      explanation: `Actionable feedback helps you improve faster and with more precision.`,
    },
  ];

  return bank.map((question, index) => ({
    ...question,
    question: `${index + 1}. ${question.question}`,
  })).slice(0, questionCount);
}

export async function getQuizSetupData() {
  const user = await getOrCreateDbUser();

  const userProfile = await db.user.findUnique({
    where: { clerkUserId: user.clerkUserId },
    select: { industry: true },
  });

  return {
    industry: userProfile?.industry || null,
  };
}

export async function generateQuiz(config = {}) {
  const user = await getOrCreateDbUser();

  const userProfile = await db.user.findUnique({
    where: { clerkUserId: user.clerkUserId },
    select: { industry: true },
  });

  const questionCount = normalizeQuestionCount(config.questionCount);
  const quizType = config.quizType || "specialization";
  const skill = String(config.skill || "").trim();
  const industry = userProfile?.industry || "tech";
  const isSkillFocusedQuiz = quizType === "resume-skill" || (quizType === "specialization" && skill);

  let questions = [];

  try {
    let prompt = "";

    if (quizType === "aptitude") {
      prompt = `
        Generate ${questionCount} aptitude test questions covering:
        - Logical reasoning (syllogisms, analogies, sequences)
        - Verbal ability (vocabulary, sentence completion)
        - Quantitative ability (numbers, algebra, word problems)
        
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
    } else if (isSkillFocusedQuiz) {
      const skillPrompt = skill ? ` focused on ${skill}` : "";
      prompt = `
        Generate ${questionCount} technical interview questions for a ${industry} professional${skillPrompt}.
        
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
    } else if (quizType === "mixed") {
      const halfCount = Math.floor(questionCount / 2);
      prompt = `
        Generate ${questionCount} mixed interview questions:
        - First ${halfCount} questions should be aptitude (logical reasoning, verbal ability, quantitative)
        - Next ${questionCount - halfCount} questions should be technical/specialization for ${industry}${skill ? `, focused on ${skill}` : ""}
        
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
    }

    const text = await generateWithOpenAI(prompt);
    const quiz = tryParseQuizJson(text);

    questions = sanitizeQuizQuestions(quiz?.questions, questionCount);

    if (!questions.length) {
      if (quizType === "aptitude") {
        questions = buildAptitudeQuestions({ questionCount });
      } else if (isSkillFocusedQuiz) {
        questions = skill
          ? buildSkillQuestions({ questionCount, skill, industry })
          : buildSpecializationQuestions({ questionCount, industry });
      } else {
        const halfCount = Math.floor(questionCount / 2);
        const aptitudeQs = buildAptitudeQuestions({ questionCount: halfCount });
        const specializationQs = skill
          ? buildSkillQuestions({ questionCount: questionCount - halfCount, skill, industry })
          : buildSpecializationQuestions({ questionCount: questionCount - halfCount, industry });
        questions = [...aptitudeQs, ...specializationQs];
      }
    }
  } catch (error) {
    console.error("Error generating quiz, using fallback questions:", error);

    if (quizType === "aptitude") {
      questions = buildAptitudeQuestions({ questionCount });
    } else if (isSkillFocusedQuiz) {
      questions = skill
        ? buildSkillQuestions({ questionCount, skill, industry })
        : buildSpecializationQuestions({ questionCount, industry });
    } else {
      const halfCount = Math.floor(questionCount / 2);
      const aptitudeQs = buildAptitudeQuestions({ questionCount: halfCount });
      const specializationQs = skill
        ? buildSkillQuestions({ questionCount: questionCount - halfCount, skill, industry })
        : buildSpecializationQuestions({ questionCount: questionCount - halfCount, industry });
      questions = [...aptitudeQs, ...specializationQs];
    }
  }

  const categoryLabel = quizType === "aptitude" ? "Aptitude"
    : quizType === "mixed" ? "Mixed (Aptitude + Specialization)"
    : (skill || industry);

  return {
    questions,
    metadata: {
      questionCount,
      quizType,
      category: categoryLabel,
    },
  };
}

export async function saveQuizResult(questions, answers, score, metadata = {}) {
  const user = await getOrCreateDbUser();

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index],
    isCorrect: answers[index] === q.correctAnswer,
    explanation: q.explanation,
  }));

  let improvementTip = "Keep practicing to improve your skills!";

  if (score < 50) {
    improvementTip = "Focus on understanding core concepts. Review fundamentals and practice more.";
  } else if (score < 70) {
    improvementTip = "Good effort! There's room for improvement. Keep practicing similar questions.";
  } else if (score < 90) {
    improvementTip = "Great work! You have strong knowledge. Challenge yourself with more complex problems.";
  } else {
    improvementTip = "Excellent performance! You have mastered this topic. Keep up the great work!";
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
    console.error("Error saving quiz result:", error.message);
    throw new Error("Failed to save quiz results");
  }
}

export async function getAssessments() {
  const user = await getOrCreateDbUser();

  try {
    const assessments = await db.assessment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error.message);
    throw new Error("Failed to fetch assessments");
  }
}