import { redirect } from "next/navigation";
import { industries } from "@/data/industries";
import OnboardingForm from "./_components/onboarding-form";
import { getCurrentUserProfile, getUserOnboardingStatus } from "@/actions/user";

export default async function OnboardingPage({ searchParams }) {
    const { isOnboarded } = await getUserOnboardingStatus();
    const resolvedSearchParams = await Promise.resolve(searchParams);
    const editParam = Array.isArray(resolvedSearchParams?.edit)
        ? resolvedSearchParams.edit[0]
        : resolvedSearchParams?.edit;
    const isEditMode = editParam === "1";

    if (isOnboarded && !isEditMode) {
        redirect("/dashboard");
    }

    let initialValues = null;
    if (isOnboarded || isEditMode) {
        const profile = await getCurrentUserProfile();
        const [industryId, ...specializationParts] = (profile?.industry || "").split("-");
        const specializationSlug = specializationParts.join("-").toLowerCase();
        const selectedIndustry = industries.find((ind) => ind.id === industryId);
        const matchedSpecialization = selectedIndustry?.subIndustries.find(
            (sub) => sub.toLowerCase().replace(/\s+/g, "-") === specializationSlug
        );

        initialValues = {
            industry: industryId || "",
            subIndustry: matchedSpecialization || "",
            experience: profile?.experience != null ? String(profile.experience) : "",
            bio: profile?.bio || "",
            skills: (profile?.skills || []).join(", "),
        };
    }

    return (
        <main>
            <OnboardingForm industries={industries} initialValues={initialValues} isEditMode={isEditMode} />
        </main>
    );
}