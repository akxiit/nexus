function getQuestionTopic(questionText = "") {
  const text = String(questionText).toLowerCase();

  if (/(binary search|stack|queue|array|hash|sorting|data structure|time complexity|algorithm)/.test(text)) {
    return "Technical fundamentals";
  }

  if (/(sql|database|table|query|index)/.test(text)) {
    return "Databases & SQL";
  }

  if (/(http|api|rest|status code|protocol|web pages)/.test(text)) {
    return "APIs & Web protocols";
  }

  if (/(git|version control|branch|commit|merge)/.test(text)) {
    return "Git & workflow";
  }

  if (/(sequence|analogy|logic|average|odd one out|quantitative|syllogism|aptitude)/.test(text)) {
    return "Aptitude";
  }

  return "General";
}

export function summarizeInterviewPerformance(assessments = []) {
  if (!Array.isArray(assessments) || assessments.length === 0) {
    return {
      summary: "Take a few quizzes to see your strongest and weakest interview areas.",
      weakArea: null,
      weakAreaScore: null,
      trendLabel: null,
      trendDelta: null,
      mistakes: [],
    };
  }

  const chronological = [...assessments].reverse();
  const categoryTotals = new Map();
  const topicTotals = new Map();
  const mistakeNotes = new Map();

  for (const assessment of assessments) {
    const category = String(assessment.category || "Technical");
    const currentCategory = categoryTotals.get(category) || { total: 0, count: 0 };
    currentCategory.total += Number(assessment.quizScore || 0);
    currentCategory.count += 1;
    categoryTotals.set(category, currentCategory);

    for (const question of assessment.questions || []) {
      if (question?.isCorrect) continue;

      const topic = getQuestionTopic(question?.question) || category;
      const topicStat = topicTotals.get(topic) || { missed: 0 };
      topicStat.missed += 1;
      topicTotals.set(topic, topicStat);

      const note =
        topic === "Aptitude"
          ? "Pattern recognition and quick calculations need more practice."
          : topic === "Databases & SQL"
            ? "SQL and database fundamentals need more repetition."
            : topic === "APIs & Web protocols"
              ? "API and HTTP basics are still inconsistent."
              : topic === "Git & workflow"
                ? "Version control concepts need more confidence."
                : `Review the core concepts behind ${topic.toLowerCase()}.`;

      mistakeNotes.set(topic, note);
    }
  }

  const weakAreaEntry = [...categoryTotals.entries()]
    .map(([category, stats]) => ({ category, average: stats.total / stats.count }))
    .sort((a, b) => a.average - b.average)[0] || null;

  const recentWindow = chronological.slice(-3);
  const previousWindow = chronological.slice(-6, -3);
  const recentAverage = recentWindow.length
    ? recentWindow.reduce((sum, assessment) => sum + Number(assessment.quizScore || 0), 0) / recentWindow.length
    : null;
  const previousAverage = previousWindow.length
    ? previousWindow.reduce((sum, assessment) => sum + Number(assessment.quizScore || 0), 0) / previousWindow.length
    : null;
  const trendDelta = recentAverage != null && previousAverage != null
    ? recentAverage - previousAverage
    : null;

  let trendLabel = null;
  if (trendDelta != null) {
    if (trendDelta > 2) {
      trendLabel = "improving";
    } else if (trendDelta < -2) {
      trendLabel = "declining";
    } else {
      trendLabel = "stable";
    }
  }

  const mistakes = [...topicTotals.entries()]
    .map(([topic, stats]) => ({ topic, count: stats.missed, note: mistakeNotes.get(topic) || "Review this topic in your next quiz." }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const weakArea = weakAreaEntry?.category || null;
  const weakAreaScore = weakAreaEntry ? Number(weakAreaEntry.average.toFixed(1)) : null;
  const primaryMistake = mistakes[0];

  const summaryParts = [];
  if (weakArea) {
    summaryParts.push(`Your weakest area is ${weakArea}${weakAreaScore != null ? ` at ${weakAreaScore}%` : ""}.`);
  }
  if (primaryMistake) {
    summaryParts.push(primaryMistake.note);
  }
  if (trendLabel && trendDelta != null) {
    const direction = trendDelta >= 0 ? "up" : "down";
    summaryParts.push(`Your recent trend is ${trendLabel} (${direction} ${Math.abs(trendDelta).toFixed(1)} points across the latest quizzes).`);
  }

  if (!summaryParts.length) {
    summaryParts.push("Keep practicing to identify patterns in your mistakes and strengthen the weakest topic.");
  }

  return {
    summary: summaryParts.join(" "),
    weakArea,
    weakAreaScore,
    trendLabel,
    trendDelta,
    mistakes,
  };
}