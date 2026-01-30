# Project Nexus Documentation: AI Career Coach

## 1. Project Overview
**Nexus** is a modern, AI-powered career coaching platform designed to help professionals accelerate their career growth. It provides tools for resume analysis, interview preparation, cover letter generation, and industry insights using advanced AI guidance.

---

## 2. Tech Stack
The project is built with a high-performance, scalable stack:
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Authentication**: [Clerk](https://clerk.dev/) for secure user management.
- **Database**: [PostgreSQL](https://www.postgresql.org/) (hosted on [Neon](https://neon.tech/)).
- **ORM**: [Prisma](https://www.prisma.io/) for database schema and migrations.
- **Background Jobs**: [Inngest](https://www.inngest.com/) for handling asynchronous AI tasks.
- **UI/UX**: 
  - **Tailwind CSS 4**: For modern, utility-first styling.
  - **Radix UI**: For accessible, unstyled UI components.
  - **Lucide React**: For consistent iconography.
  - **Sonner**: For elegant toast notifications.

---

## 3. Directory Structure & File Requirements

### Root Directory
- `.env`: Contains environment variables (Database URLs, Clerk Keys, Inngest Keys).
- `package.json`: Defines project dependencies, scripts, and metadata.
- `prisma/schema.prisma`: The "Source of Truth" for the database structure. Defines models for Users, Resumes, Cover Letters, and Assessments.
- `middleware.js`: Handles authentication checks and route protection using Clerk.
- `jsconfig.json`: Configures path aliases (e.g., `@/*` for the root directory).
- `postcss.config.mjs` & `next.config.mjs`: Configuration files for Tailwind and Next.js.
- `components.json`: Configuration for Radix/Shadcn-like component architecture.

### `app/` (The Core Application)
- `layout.js`: The root layout containing global providers (Clerk, Theme, etc.).
- `page.jsx`: The public landing page showcasing features, testimonials, and FAQs.
- `(auth)/`: Contains sign-in and sign-up pages handled by Clerk.
- `(main)/`: Protected routes for authenticated users.
  - `dashboard/`: User's career overview and performance metrics.
  - `onboarding/`: Initial profile setup and industry selection.
  - `resume/`: Tools for resume management and AI-based ATS scoring.
  - `interview/`: Mock interviews and behavioral assessment tools.
  - `ai-cover-letter/`: Automated cover letter generation based on job descriptions.
- `api/inngest/`: Endpoint for receiving background job triggers.

### `lib/` (Utilities & Clients)
- `prisma.js`: Initializes and exports a singleton Prisma Client instance.
- `checkUser.js`: A critical helper that ensures every Clerk user has a corresponding record in the local PostgreSQL database.
- `inngest/`: Configuration and function definitions for background processes.

### `components/`
- `ui/`: Reusable, atomic UI components (Buttons, Inputs, Cards, etc.) powered by Radix UI.
- `header.jsx` & `hero.jsx`: Major block components for the UI layout.
- `theme-provider.jsx`: Handles Dark/Light mode switching.

### `data/`
- Contains static data for the landing page (features, FAQs, industry lists) to keep the UI code clean and maintainable.

---

## 4. Project Workflow

### 1. User Authentication & Onboarding
- **Sign Up**: Users join via Clerk.
- **Syncing**: The `checkUser` utility runs upon first login to create a user profile in the database.
- **Onboarding**: Users are prompted to select their industry and sub-industry, which helps the AI tailor its suggestions.

### 2. Industry Insights
- The system fetches/updates `IndustryInsight` data (salary ranges, growth rates, top skills) using background jobs to provide users with market-specific guidance.

### 3. Career Optimization Tools
- **Resume Building**: Users upload or create a resume and get an AI-generated **ATS Score** and feedback.
- **Interview Prep**: Users can take mock quizzes. The system saves the results in the `Assessment` model and provides improvement tips.
- **Cover Letter Generation**: Based on a job description and the user's profile, the AI generates professional cover letters.

### 4. Background Processing
- Heavy AI operations (like updating industry trends every few days) are offloaded to **Inngest** to ensure the main application remains fast and responsive.

---

## 5. Why this architecture?
- **Separation of Concerns**: UI, logic, and data are strictly separated into `components`, `lib`, and `prisma`.
- **Scalability**: Using Next.js Server Components and Inngest allows the app to handle complex AI tasks without slowing down the user experience.
- **Robustness**: Prisma provides type-safe database access, reducing runtime errors.
- **Security**: Clerk handles the complexities of authentication, so user data remains protected.
