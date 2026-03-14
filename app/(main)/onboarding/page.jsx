import { getUserOnboardingStatus } from '@/action/user';
import { industries } from '@/data/industries';
import { redirect } from 'next/dist/server/api-utils';
import {react} from 'react';

const OnboardingPage =async  () => {
// Check if user is already onboarding
    const {isOnboarded}=await getUserOnboardingStatus();

    if (isOnboarded){
        redirect('/dashboard');
    }

    return (<main> 
        <OnboardingForm industries = {industries}/>
    </main>);
}

export default OnboardingPage;