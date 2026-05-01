"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
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

const TECH_SPECIALIZATIONS = [
    "Artificial Intelligence / Machine Learning",
    "Data Science",
    "Web Development",
    "Cybersecurity",
    "Cloud Computing",
    "DevOps",
];

const OnboardingForm = ({ initialValues, isEditMode = false }) => {
    const router = useRouter();

    const { loading: updateLoading, fn: updateUserFn, data: updateResult } = useFetch(updateUser);

    const normalizedInitialValues = useMemo(() => ({
        industry: "tech",
        subIndustry: initialValues?.subIndustry || "",
        experience: initialValues?.experience || "",
        bio: initialValues?.bio || "",
    }), [initialValues]);

    const { register, handleSubmit, formState: { errors }, setValue, control, reset } = useForm({
        resolver: zodResolver(onboardingSchema),
        defaultValues: normalizedInitialValues,
    });

    useEffect(() => {
        reset(normalizedInitialValues);
    }, [normalizedInitialValues, reset]);

    const onSubmit = async (values) => {
        try {
            await updateUserFn({
                subIndustry: values.subIndustry,
                experience: values.experience,
                bio: values.bio,
            });
        } catch (error) {
            console.error("Onboarding error:", error);
        }
    };

    useEffect(() => {
        if (updateResult && !updateLoading) {
            toast.success(isEditMode ? "Profile updated!" : "Profile completed!");
            router.replace("/interview");
        }
    }, [updateResult, updateLoading, router, isEditMode]);

    const watchSubIndustry = useWatch({ control, name: "subIndustry" });

    return (
        <div className="flex items-center justify-center bg-background">
            <Card className="w-full max-w-lg mt-10 mx-2">
                <CardHeader>
                    <CardTitle className="gradient-title text-4xl">Complete Your Profile</CardTitle>
                    <CardDescription>
                        Select your specialization to get personalized career insights.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="hidden">
                            <input type="hidden" {...register("industry")} value="tech" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subIndustry">Specialization</Label>
                            <Select
                                value={watchSubIndustry || ""}
                                onValueChange={(value) => setValue("subIndustry", value, { shouldDirty: true, shouldValidate: true })}
                            >
                                <SelectTrigger id="subIndustry">
                                    <SelectValue placeholder="Select your specialization" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Technology Specializations</SelectLabel>
                                        {TECH_SPECIALIZATIONS.map((sub) => (
                                            <SelectItem key={sub} value={sub}>
                                                {sub}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {errors.subIndustry && <p className="text-sm text-red-500">{errors.subIndustry.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="experience">Years of Experience</Label>
                            <Controller
                                name="experience"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        id="experience"
                                        type="number"
                                        min="0"
                                        max="50"
                                        placeholder="Enter years of experience"
                                        value={field.value ?? ""}
                                        onChange={(event) => field.onChange(event.target.value)}
                                        onBlur={field.onBlur}
                                        ref={field.ref}
                                    />
                                )}
                            />
                            {errors.experience && <p className="text-sm text-red-500">{errors.experience.message}</p>}
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