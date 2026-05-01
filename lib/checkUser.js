import { currentUser } from "@clerk/nextjs/server";


export const checkUser = async () => {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    // Allow public pages to render even if DB env vars are not configured yet.
    if (!process.env.DATABASE_URL) {
        return null;
    }

    try {
        const { getOrCreateDbUser } = await import("@/actions/user");
        return await getOrCreateDbUser();
    }
    catch (error) {
        console.log(error.message);
        return null;
    }

};