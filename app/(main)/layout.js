import {react} from 'react';

const MainLayout = ({children}) => {
// Redirect to onboaring

    return(
        <div className='container mx-auto mt-24 mb-20'>{children}</div>
    );
}

export default MainLayout;