import { getAssessments } from "@/actions/interview";
import { summarizeInterviewPerformance } from "@/lib/interview-summary";
import StatsCards from "./_components/stats-cards";
import PerformanceChart from "./_components/performace-chart";
import PerformanceInsights from "./_components/performance-insights";
import QuizList from "./_components/quiz-list";

export default async function InterviewPrepPage() {
    const assessments = await getAssessments();
    const insights = summarizeInterviewPerformance(assessments);

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <h1 className="text-6xl font-bold gradient-title">Interview Preparation</h1>
            </div>
            <div className="space-y-6">
                <StatsCards assessments={assessments} />
                <PerformanceInsights insights={insights} />
                <PerformanceChart assessments={assessments} />
                <QuizList assessments={assessments} />
            </div>
        </div>
    );
}