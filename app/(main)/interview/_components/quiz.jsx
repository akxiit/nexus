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
const QUIZ_TYPE_OPTIONS = [
    { value: "aptitude", label: "Aptitude" },
    { value: "resume-skill", label: "Resume Skill" },
    { value: "specialization", label: "Specialization" },
    { value: "mixed", label: "Mixed (Both)" },
];

export default function Quiz({ specialization = "", skill = "", availableSkills = [] }) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [showExplanation, setShowExplanation] = useState(false);
    const [quizType, setQuizType] = useState(skill ? "resume-skill" : (availableSkills.length ? "resume-skill" : "specialization"));
    const [selectedSkill, setSelectedSkill] = useState(skill || availableSkills[0] || "");
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
                quizType: quizMeta?.quizType,
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
        if (quizType === "resume-skill" && !selectedSkill) {
            toast.error("Please select a skill from your resume");
            return;
        }

        await generateQuizFn({
            quizType,
            questionCount,
            skill: quizType === "resume-skill" ? selectedSkill : skill,
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
                    {specialization && (
                        <div className="bg-muted p-3 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                Specialization: <span className="font-medium">{specialization}</span>
                            </p>
                        </div>
                    )}

                    {skill && (
                        <div className="bg-muted p-3 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                Skill Focus: <span className="font-medium">{skill}</span>
                            </p>
                        </div>
                    )}

                    {quizType === "resume-skill" && (
                        <div className="space-y-2">
                            <Label>Resume Skill</Label>
                            <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                                <SelectTrigger>
                                    <SelectValue placeholder={availableSkills.length ? "Select a skill from your resume" : "Add skills to your resume first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSkills.map((resumeSkill) => (
                                        <SelectItem key={resumeSkill} value={resumeSkill}>
                                            {resumeSkill}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!availableSkills.length && (
                                <p className="text-xs text-muted-foreground">Add skills in the resume builder to unlock skill-based quizzes.</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Quiz Type</Label>
                        <Select
                            value={quizType}
                            onValueChange={(value) => {
                                setQuizType(value);
                                if (value === "resume-skill" && !selectedSkill) {
                                    setSelectedSkill(availableSkills[0] || "");
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select quiz type" />
                            </SelectTrigger>
                            <SelectContent>
                                {QUIZ_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

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
                <CardTitle className="text-lg">
                    Question {currentQuestion + 1} of {quizQuestions.length}
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                    {quizMeta?.quizType === "aptitude" && "Aptitude"}
                    {quizMeta?.quizType === "resume-skill" && `Resume Skill: ${skill || selectedSkill}`}
                    {quizMeta?.quizType === "specialization" && `Specialization: ${skill || specialization}`}
                    {quizMeta?.quizType === "mixed" && "Mixed (Aptitude + Specialization)"}
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <p className="text-lg font-medium">{question?.question}</p>
                </div>

                <RadioGroup
                    value={answers[currentQuestion] || ""}
                    onValueChange={handleAnswer}
                    className="space-y-2"
                >
                    {question?.options?.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`option-${index}`} />
                            <Label htmlFor={`option-${index}`} className="cursor-pointer flex-1">
                                {option}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>

                {showExplanation && (
                    <div className="bg-muted p-3 rounded-lg">
                        <p className="font-medium">Explanation:</p>
                        <p className="text-sm text-muted-foreground">{question?.explanation}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                {!showExplanation && (
                    <Button variant="outline" onClick={() => setShowExplanation(true)} className="w-full">
                        Show Explanation
                    </Button>
                )}
                <Button onClick={handleNext} className="w-full">
                    {currentQuestion < quizQuestions.length - 1 ? "Next Question" : "Finish Quiz"}
                </Button>
                <Button
                    variant="link"
                    onClick={() => {
                        setCurrentQuestion(0);
                        setShowExplanation(false);
                    }}
                >
                    Start Over
                </Button>
            </CardFooter>
        </Card>
    );
}