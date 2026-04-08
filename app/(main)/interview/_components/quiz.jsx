"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateQuiz, saveQuizResult } from "@/actions/interview";
import QuizResult from "./quiz-result";
import useFetch from "@/hooks/use-fetch";
import { BarLoader } from "react-spinners";

const QUESTION_COUNT_OPTIONS = [10, 12, 15, 20, 25];

export default function Quiz({ availableSkills = [] }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizMode, setQuizMode] = useState("single");
  const [selectedSkill, setSelectedSkill] = useState(availableSkills[0] || "");
  const [questionCount, setQuestionCount] = useState("10");

  const { loading: generatingQuiz, fn: generateQuizFn, data: quizData, setData: setQuizData } = useFetch(generateQuiz);
  const { loading: savingResult, fn: saveQuizResultFn, data: resultData, setData: setResultData } = useFetch(saveQuizResult);

  const quizQuestions = useMemo(() => quizData?.questions || [], [quizData]);
  const quizMeta = quizData?.metadata || null;

  useEffect(() => {
    if (quizQuestions.length) {
      setAnswers(new Array(quizQuestions.length).fill(null));
    }
  }, [quizQuestions]);

  const handleAnswer = (answer) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowExplanation(false);
    } else {
      finishQuiz();
    }
  };

  const calculateScore = () => {
    let correct = 0;
    answers.forEach((answer, index) => {
      if (answer === quizQuestions[index].correctAnswer) {
        correct++;
      }
    });
    return (correct / quizQuestions.length) * 100;
  };

  const finishQuiz = async () => {
    const score = calculateScore();
    try {
      await saveQuizResultFn(quizQuestions, answers, score, {
        category: quizMeta?.category,
        selectedSkill: quizMeta?.selectedSkill,
        quizMode: quizMeta?.quizMode,
      });
      toast.success("Quiz completed!");
    } catch (error) {
      toast.error(error.message || "Failed to save quiz results");
    }
  };

  const startNewQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowExplanation(false);
    setQuizData(null);
    setResultData(null);
  };

  const handleStartQuiz = async () => {
    if (quizMode === "single" && availableSkills.length && !selectedSkill) {
      toast.error("Please select a skill");
      return;
    }

    await generateQuizFn({
      quizMode,
      selectedSkill: quizMode === "single" ? selectedSkill : "",
      questionCount,
    });
  };

  if (generatingQuiz) {
    return <BarLoader className="mt-4" width={"100%"} color="gray" />;
  }

  if (resultData) {
    return (
      <div className="mx-2">
        <QuizResult result={resultData} onStartNew={startNewQuiz} />
      </div>
    );
  }

  if (!quizData) {
    return (
      <Card className="mx-2">
        <CardHeader>
          <CardTitle>Ready to test your knowledge?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Configure your quiz by skill and number of questions, then start when ready.
          </p>

          <div className="space-y-2">
            <Label>Quiz Type</Label>
            <Select value={quizMode} onValueChange={setQuizMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select quiz type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Skill</SelectItem>
                <SelectItem value="mixed">Mixed Skills</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {quizMode === "single" && (
            <div className="space-y-2">
              <Label>Skill</Label>
              <Select
                value={selectedSkill}
                onValueChange={setSelectedSkill}
                disabled={!availableSkills.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={availableSkills.length ? "Select a skill" : "No saved skills found"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill} value={skill}>
                      {skill}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!availableSkills.length && (
                <p className="text-sm text-muted-foreground">Add skills in your preferences to unlock skill-based quizzes.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Number of Questions</Label>
            <Select value={questionCount} onValueChange={setQuestionCount}>
              <SelectTrigger>
                <SelectValue placeholder="Select question count" />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_COUNT_OPTIONS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} Questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Allowed range: 10 to 25 questions.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStartQuiz} className="w-full">
            Start Quiz
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const question = quizQuestions[currentQuestion];

  return (
    <Card className="mx-2">
      <CardHeader>
        <CardTitle>
          Question {currentQuestion + 1} of {quizQuestions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-medium">{question.question}</p>
        <RadioGroup onValueChange={handleAnswer} value={answers[currentQuestion]} className="space-y-2">
          {question.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={option} id={`option-${index}`} />
              <Label htmlFor={`option-${index}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>

        {showExplanation && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="font-medium">Explanation:</p>
            <p className="text-muted-foreground">{question.explanation}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {!showExplanation && (
          <Button onClick={() => setShowExplanation(true)} variant="outline" disabled={!answers[currentQuestion]}>
            Show Explanation
          </Button>
        )}
        <Button onClick={handleNext} disabled={!answers[currentQuestion] || savingResult} className="ml-auto">
          {savingResult && <BarLoader className="mt-4" width={"100%"} color="gray" />}
          {currentQuestion < quizQuestions.length - 1 ? "Next Question" : "Finish Quiz"}
        </Button>
      </CardFooter>
    </Card>
  );
}