import { getResume } from "@/actions/resume";
import { getCurrentUserProfile } from "@/actions/user";
import ResumeBuilder from "./_components/resume-builder";

export default async function ResumePage() {
  const resume = await getResume();
  const profile = await getCurrentUserProfile();
  const specialization = profile?.industry
    ? profile.industry.replace(/^tech-/, "").replace(/-/g, " ")
    : "";

  return (
    <div className="container mx-auto py-6">
      <ResumeBuilder
        initialContent={resume?.content}
        userProfile={{
          specialization,
          experience: profile?.experience ?? null,
          skills: profile?.skills ?? [],
        }}
      />
    </div>
  );
}