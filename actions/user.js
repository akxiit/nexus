"use server";

import { db } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";

export async function getOrCreateDbUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existingUser = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (existingUser) {
    return existingUser;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unauthorized");

  const email =
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    clerkUser.primaryEmailAddress?.emailAddress ||
    `${clerkUser.id}@no-email.local`;
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || "User";

  return await db.user.create({
    data: {
      clerkUserId: clerkUser.id,
      name,
      imageUrl: clerkUser.imageUrl,
      email,
    },
  });
}

export async function updateUser(data) {
  const user = await getOrCreateDbUser();

  try {
    const result = await db.$transaction(
      async (tx) => {
        let industryInsight = await tx.industryInsight.findUnique({
          where: {
            industry: data.industry,
          },
        });

        if (!industryInsight) {
          const insights = await generateAIInsights(data.industry);

          try {
            industryInsight = await tx.industryInsight.create({
              data: {
                industry: data.industry,
                ...insights,
                nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            });
          } catch (createError) {
            // If another request created the same industry concurrently, use that row.
            if (createError?.code === "23505") {
              industryInsight = await tx.industryInsight.findUnique({
                where: { industry: data.industry },
              });
            } else {
              throw createError;
            }
          }
        }

        const updatedUser = await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            industry: data.industry,
            experience: data.experience,
            bio: data.bio,
            skills: data.skills,
          },
        });

        return { updatedUser, industryInsight };
      },
      {
        timeout: 10000,
      }
    );

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/interview");
    revalidatePath("/resume");
    revalidatePath("/onboarding");
    return result.updatedUser;
  } catch (error) {
    console.error("Error updating user and industry:", error.message);
    throw new Error("Failed to update profile");
  }
}

export async function getUserOnboardingStatus() {
  const user = await getOrCreateDbUser();

  try {
    const userIndustry = await db.user.findUnique({
      where: { clerkUserId: user.clerkUserId },
      select: {
        industry: true,
      },
    });

    return {
      isOnboarded: !!userIndustry?.industry,
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error.message);
    throw new Error("Failed to check onboarding status");
  }
}

export async function getCurrentUserProfile() {
  const user = await getOrCreateDbUser();

  try {
    return await db.user.findUnique({
      where: { clerkUserId: user.clerkUserId },
      select: {
        industry: true,
        experience: true,
        bio: true,
        skills: true,
      },
    });
  } catch (error) {
    console.error("Error fetching current user profile:", error.message);
    throw new Error("Failed to fetch profile");
  }
}