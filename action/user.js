"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { exportPages } from "next/dist/export/worker";
import {db} from "@/lib/prisma"

export async function UpdateUser(data) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: {
            clerkUserId: userId,
        },
    });

    if (!user) throw new Error("User not found");

    try{
        const result = await db.$transaction(async (tx) => {
            //find if the industry exists in the database
            let industryInsights = await tx.industryInsights.findUnique({
                where: {
                    industry: data.industry,
                },
            });
            //if not exist create it with default values - will replace it with ai

            if(!industryInsights) {
                industryInsights = await tx.industryInsights.create({
                    data:{
                        industry: data.industry,
                        salaryRanges: [],
                        growthRate: 0,
                        demadLevel: "Medium",
                        topSkills: [],
                        marketOutlook: "Neutral",
                        keyTrends: [],
                        recommendedSkills: [],
                        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Set next update to one week later
                    },
                });
            }
            //update the user

            const updatedUser = await tx.user.update({
                where: {
                    id: user.id,
                },
                data:{
                    industry: data.industry,
                    experience: data.experience,
                    bio: data.bio,
                    skills: data.skills,
                }
            });

            return {updatedUser, industryInsights};
        },{
            timeout: 10000,
        });

        return result.user;
        
    }
    catch(error){
        console.error("Error updating user and industry:", error.message);
        throw new Error("Failed to update profile");
    }
}


export async function getUserOnboardingStatus(data) {

    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: {
            clerkUserId: userId,
        },
    });

    if (!user) throw new Error("User not found");

    try{
        const user = await db.user.findUnique({
            where: {
                clerkUserId: userId,
            },
            select: {
                industry: true,
            },
        });

        return {
            isOnboarded: !!user?.industry,
        };
    }
    catch(error){
        console.error("Error checking onboarding status:", error.message);
        throw new Error("Failed to check onboarding status");
    }
}