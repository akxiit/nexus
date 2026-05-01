import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Quiz from "../_components/quiz";
import { getQuizSetupData } from "@/actions/interview";
import { getResumeSkills } from "@/actions/resume";

export const dynamic = 'force-dynamic';

export default async function MockInterviewPage({ searchParams }) {
  const [setup, resumeSkills] = await Promise.all([getQuizSetupData(), getResumeSkills()]);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const selectedSkill = Array.isArray(resolvedSearchParams?.skill)
    ? resolvedSearchParams.skill[0]
    : resolvedSearchParams?.skill || "";

  const specialization = setup?.industry 
    ? setup.industry.replace('tech-', '').replace(/-/g, ' ')
    : "";

  return (
    <div className="container mx-auto space-y-4 py-6">
      <div className="flex flex-col space-y-2 mx-2">
        <Link href="/interview">
          <Button variant="link" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            Back to Interview Preparation
          </Button>
        </Link>

        <div>
          <h1 className="text-6xl font-bold gradient-title">Mock Interview</h1>
        </div>
      </div>

      <Quiz specialization={specialization} skill={selectedSkill} availableSkills={resumeSkills} />
    </div>
  );
}
