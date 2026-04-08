import { currentUser } from "@clerk/nextjs/server"
import { db } from "./prisma"
import { getOrCreateDbUser } from "@/actions/user"


export const checkUser = async () => {
    const user = await currentUser();

    if (!user){
        return null;
    }

    try{
        return await getOrCreateDbUser();
      }
      catch (error){
        console.log(error.message)
    }

}