"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import useFetch from "@/hooks/use-fetch";
import { onboardingSchema } from "@/app/lib/schema";
import { updateUser } from "@/actions/user";
import { getIndustrySkillSuggestions } from "@/actions/dashboard";

const OnboardingForm = ({ industries, initialValues, isEditMode = false }) => {
    const router = useRouter();

    const localSkillSuggestions = useMemo(() => ({
        tech: [
            "JavaScript",
            "TypeScript",
            "React",
            "Next.js",
            "Node.js",
            "Python",
            "SQL",
            "REST APIs",
            "Git",
            "System Design",
            "Cloud",
            "Docker",
            "Testing",
            "CI/CD",
        ],
        finance: [
            "Financial Analysis",
            "Excel",
            "Accounting",
            "Risk Analysis",
            "Valuation",
            "Modeling",
            "Data Analysis",
            "Compliance",
            "SQL",
            "Power BI",
        ],
        healthcare: [
            "Clinical Research",
            "Healthcare Analytics",
            "Patient Care",
            "HIPAA",
            "Data Analysis",
            "Biostatistics",
            "Medical Coding",
            "Pharmacovigilance",
        ],
        manufacturing: [
            "Quality Control",
            "Lean Manufacturing",
            "Supply Chain",
            "Process Improvement",
            "Six Sigma",
            "Operations",
            "Automation",
            "Inventory Management",
        ],
        retail: [
            "Merchandising",
            "E-commerce",
            "Customer Experience",
            "Inventory Management",
            "Sales Analytics",
            "CRM",
            "Digital Marketing",
            "Product Management",
        ],
        media: [
            "Content Strategy",
            "SEO",
            "Social Media",
            "Video Editing",
            "Copywriting",
            "Brand Strategy",
            "Analytics",
            "Audience Engagement",
        ],
        education: [
            "Curriculum Design",
            "Instructional Design",
            "EdTech",
            "Assessment Design",
            "Classroom Management",
            "Learning Analytics",
            "Training",
            "LMS",
        ],
        energy: [
            "Renewable Energy",
            "Energy Management",
            "Sustainability",
            "Data Analysis",
            "Project Management",
            "Safety Compliance",
            "Grid Systems",
            "Carbon Reporting",
        ],
        consulting: [
            "Problem Solving",
            "Presentation Skills",
            "Stakeholder Management",
            "Strategy",
            "Research",
            "Excel",
            "PowerPoint",
            "Business Analysis",
        ],
        telecom: [
            "Networking",
            "5G",
            "Fiber Optics",
            "Cloud Communications",
            "Network Security",
            "Systems Analysis",
            "Infrastructure",
        ],
        transportation: [
            "Logistics",
            "Supply Chain",
            "Fleet Management",
            "Operations",
            "Route Optimization",
            "Data Analysis",
            "Automation",
        ],
        agriculture: [
            "AgTech",
            "Crop Management",
            "Soil Analysis",
            "Sustainability",
            "Data Collection",
            "Equipment Maintenance",
            "Supply Chain",
        ],
        construction: [
            "Project Management",
            "AutoCAD",
            "Blueprint Reading",
            "Site Safety",
            "Budgeting",
            "Scheduling",
            "BIM",
        ],
        hospitality: [
            "Customer Service",
            "Operations",
            "Event Planning",
            "Revenue Management",
            "Sales",
            "Guest Experience",
        ],
        nonprofit: [
            "Grant Writing",
            "Fundraising",
            "Community Outreach",
            "Program Management",
            "Advocacy",
            "Volunteer Coordination",
        ],
    }), []);

    const { loading: updateLoading, fn: updateUserFn, data: updateResult } = useFetch(updateUser);
    const { loading: suggestionsLoading, fn: loadSkillSuggestions, data: suggestedSkills = [] } = useFetch(getIndustrySkillSuggestions);

    const normalizedInitialValues = useMemo(() => ({
        industry: initialValues?.industry || "",
        subIndustry: initialValues?.subIndustry || "",
        experience: initialValues?.experience || "",
        skills: initialValues?.skills || "",
        bio: initialValues?.bio || "",
    }), [initialValues]);

    const { register, handleSubmit, formState: { errors }, setValue, control, reset } = useForm({
        resolver: zodResolver(onboardingSchema),
        defaultValues: normalizedInitialValues,
    });

    const loadSkillSuggestionsRef = useRef(loadSkillSuggestions);

    useEffect(() => {
        loadSkillSuggestionsRef.current = loadSkillSuggestions;
    }, [loadSkillSuggestions]);

    useEffect(() => {
        reset(normalizedInitialValues);
    }, [normalizedInitialValues, reset]);

    const onSubmit = async (values) => {
        try {
            const formattedIndustry = `${values.industry}-${values.subIndustry.toLowerCase().replace(/ /g, "-")}`;
            await updateUserFn({
                ...values,
                industry: formattedIndustry,
            });
        } catch (error) {
            console.error("Onboarding error:", error);
        }
    };

    useEffect(() => {
        if (updateResult && !updateLoading) {
            toast.success(isEditMode ? "Profile updated successfully!" : "Profile completed successfully!");
            router.push("/dashboard");
            router.refresh();
        }
    }, [updateResult, updateLoading, router, isEditMode]);

    const watchIndustry = useWatch({ control, name: "industry" });
    const watchSubIndustry = useWatch({ control, name: "subIndustry" });
    const watchSkills = useWatch({ control, name: "skills" }) || "";

    const selectedIndustry = useMemo(
        () => industries.find((ind) => ind.id === watchIndustry) || null,
        [industries, watchIndustry]
    );

    useEffect(() => {
        if (!watchIndustry || !watchSubIndustry) return;

        loadSkillSuggestionsRef.current({
            industryId: watchIndustry,
            subIndustry: watchSubIndustry,
            limit: 20,
        }).catch(() => {
            // Errors are handled in useFetch toast; keep UI interactive.
        });
    }, [watchIndustry, watchSubIndustry]);

    const currentSkillToken = useMemo(() => {
        const parts = watchSkills.split(",");
        return (parts[parts.length - 1] || "").trim().toLowerCase();
    }, [watchSkills]);

    const selectedSkillSet = useMemo(() => {
        return new Set(
            watchSkills
                .split(",")
                .map((skill) => skill.trim().toLowerCase())
                .filter(Boolean)
        );
    }, [watchSkills]);

    const combinedSkillSuggestions = useMemo(() => {
        const localPool = localSkillSuggestions[watchIndustry] || [];
        return [...new Set([...localPool, ...suggestedSkills])];
    }, [localSkillSuggestions, watchIndustry, suggestedSkills]);

    const filteredSuggestions = useMemo(() => {
        if (!currentSkillToken || currentSkillToken.length < 1) return [];

        return combinedSkillSuggestions
            .filter((skill) => {
                const normalized = skill.toLowerCase();
                return (normalized.startsWith(currentSkillToken) || normalized.includes(currentSkillToken)) && !selectedSkillSet.has(normalized);
            })
            .slice(0, 6);
    }, [combinedSkillSuggestions, currentSkillToken, selectedSkillSet]);

    const applySkillSuggestion = (skill) => {
        const parts = watchSkills.split(",");
        parts[parts.length - 1] = ` ${skill}`;

        const cleaned = parts
            .map((part) => part.trim())
            .filter(Boolean)
            .join(", ");

        setValue("skills", `${cleaned}, `, { shouldValidate: true, shouldDirty: true });
    };

    return (
        <div className="flex items-center justify-center bg-background">
            <Card className="w-full max-w-lg mt-10 mx-2">
                <CardHeader>
                    <CardTitle className="gradient-title text-4xl">Complete Your Profile</CardTitle>
                    <CardDescription>
                        Select your industry to get personalized career insights and recommendations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <Select
                                value={watchIndustry || ""}
                                onValueChange={(value) => {
                                    setValue("industry", value);
                                    setValue("subIndustry", "", { shouldDirty: true, shouldValidate: true });
                                }}
                            >
                                <SelectTrigger id="industry">
                                    <SelectValue placeholder="Select an industry" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Industries</SelectLabel>
                                        {industries.map((ind) => (
                                            <SelectItem key={ind.id} value={ind.id}>
                                                {ind.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {errors.industry && <p className="text-sm text-red-500">{errors.industry.message}</p>}
                        </div>

                        {watchIndustry && (
                            <div className="space-y-2">
                                <Label htmlFor="subIndustry">Specialization</Label>
                                <Select value={watchSubIndustry || ""} onValueChange={(value) => setValue("subIndustry", value, { shouldDirty: true, shouldValidate: true })}>
                                    <SelectTrigger id="subIndustry">
                                        <SelectValue placeholder="Select your specialization" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Specializations</SelectLabel>
                                            {selectedIndustry?.subIndustries.map((sub) => (
                                                <SelectItem key={sub} value={sub}>
                                                    {sub}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {errors.subIndustry && <p className="text-sm text-red-500">{errors.subIndustry.message}</p>}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="experience">Years of Experience</Label>
                            <Input id="experience" type="number" min="0" max="50" placeholder="Enter years of experience" {...register("experience")} />
                            {errors.experience && <p className="text-sm text-red-500">{errors.experience.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="skills">Skills</Label>
                            <Input id="skills" placeholder="e.g., Python, JavaScript, Project Management" {...register("skills")} />
                            <p className="text-sm text-muted-foreground">Separate multiple skills with commas. Start typing 1-2 letters to get suggestions.</p>
                            {suggestionsLoading && watchIndustry && watchSubIndustry && (
                                <p className="text-sm text-muted-foreground">Loading skill suggestions...</p>
                            )}
                            {filteredSuggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {filteredSuggestions.map((skill) => (
                                        <Button
                                            key={skill}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => applySkillSuggestion(skill)}
                                        >
                                            {skill}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            {errors.skills && <p className="text-sm text-red-500">{errors.skills.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio">Professional Bio</Label>
                            <Textarea id="bio" placeholder="Tell us about your professional background..." className="h-32" {...register("bio")} />
                            {errors.bio && <p className="text-sm text-red-500">{errors.bio.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={updateLoading}>
                            {updateLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                isEditMode ? "Update Preferences" : "Complete Profile"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default OnboardingForm;