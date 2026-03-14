import {react} from 'react';
import { getUserOnboardingStatus } from '@/action/user';

const IndustryInsightsPage = async () => {
    const {isOnboarded} = await getUserOnboardingStatus();
    
        if (!isOnboarded){
            redirect('/onboarding');
        }
    return <div> IndustryInsightsPage</div>;
}

export default IndustryInsightsPage;    