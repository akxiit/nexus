import { redirect } from "next/navigation";
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
        const [, ...specializationParts] = (profile?.industry || "").split("-");
        const specialization = specializationParts.join(" ");

        initialValues = {
            subIndustry: specialization || "",
            experience: profile?.experience != null ? String(profile.experience) : "",
            bio: profile?.bio || "",
        };
    }

    return (
        <main>
            <OnboardingForm initialValues={initialValues} isEditMode={isEditMode} />
        </main>
    );
}