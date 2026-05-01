"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Download, Edit, Loader2, Monitor, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { saveResume, generateProfessionalSummary } from "@/actions/resume";
import { EntryForm } from "./entry-form";
import useFetch from "@/hooks/use-fetch";
import { useUser } from "@clerk/nextjs";
import { entriesToMarkdown } from "@/app/lib/helper";
import { resumeSchema } from "@/app/lib/schema";

const parseSkillList = (skillsText = "") =>
  skillsText
    .split(/,|\n/)
    .map((skill) => skill.trim())
    .filter(Boolean);

export default function ResumeBuilder({ initialContent, userProfile }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState(initialContent);
  const router = useRouter();
  const { user } = useUser();
  const [resumeMode, setResumeMode] = useState("preview");

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      contactInfo: {},
      summary: "",
      skills: "",
      experience: [],
      education: [],
      projects: [],
    },
  });

  const { loading: isSaving, fn: saveResumeFn, data: saveResult, error: saveError } = useFetch(saveResume);
  const formValues = watch();
  const resumeSkills = useMemo(() => parseSkillList(formValues.skills), [formValues.skills]);
  const profileSkills = useMemo(() => {
    if (Array.isArray(userProfile?.skills)) {
      return userProfile.skills.filter(Boolean).map(String);
    }

    return parseSkillList(String(userProfile?.skills || ""));
  }, [userProfile?.skills]);
  const specialization = userProfile?.specialization || "Technology professional";

  const normalizeProfileUrl = (value, platform) => {
    const raw = value?.trim();
    if (!raw) return "";

    const fromPathname = (urlString) => {
      try {
        const parsed = new URL(urlString);
        const username = parsed.pathname.split("/").filter(Boolean)[0];
        return username || "";
      } catch {
        return "";
      }
    };

    const directUsername = raw.replace(/^@/, "").split(/[/?#]/)[0].trim();
    const username = raw.startsWith("http") ? fromPathname(raw) : directUsername;

    if (!username) return "";

    if (platform === "linkedin") {
      return `https://www.linkedin.com/in/${username}`;
    }

    return `https://x.com/${username}`;
  };

  useEffect(() => {
    if (initialContent) {
      setActiveTab("preview");
    }
  }, [initialContent]);

  useEffect(() => {
    if (saveResult && !isSaving) {
      toast.success("Resume saved successfully!");
    }
    if (saveError) {
      toast.error(saveError.message || "Failed to save resume");
    }
  }, [saveResult, saveError, isSaving]);

  useEffect(() => {
    if (activeTab === "edit") {
      const { contactInfo, summary, skills, experience, education, projects } = formValues;
      const parts = [];
      const linkedInUrl = normalizeProfileUrl(contactInfo?.linkedin, "linkedin");
      const xUrl = normalizeProfileUrl(contactInfo?.twitter, "twitter");

      if (contactInfo?.email) parts.push(`📧 ${contactInfo.email}`);
      if (contactInfo?.mobile) parts.push(`📱 ${contactInfo.mobile}`);
      if (linkedInUrl) parts.push(`💼 [LinkedIn](${linkedInUrl})`);
      if (xUrl) parts.push(`🐦 [X](${xUrl})`);

      const contactMarkdown = parts.length > 0
        ? `## <div align="center">${user?.fullName || "User"}</div>\n\n<div align="center">\n\n${parts.join(" | ")}\n\n</div>`
        : "";

      const newContent = [
        contactMarkdown,
        summary && `## Professional Summary\n\n${summary}`,
        skills && `## Skills\n\n${skills}`,
        entriesToMarkdown(experience, "Work Experience"),
        entriesToMarkdown(education, "Education"),
        entriesToMarkdown(projects, "Projects"),
      ]
        .filter(Boolean)
        .join("\n\n");

      setPreviewContent(newContent ? newContent : initialContent);
    }
  }, [formValues, activeTab, initialContent, user?.fullName]);

  const [isGenerating, setIsGenerating] = useState(false);

  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      const experienceSummary = formValues.experience
        ?.map((entry) => `${entry.title || "Role"} at ${entry.organization || "Company"}: ${entry.description || "Relevant experience"}`)
        .join("; ");
      const skills = resumeSkills.length ? resumeSkills : profileSkills;

      const result = await generateProfessionalSummary({
        specialization,
        experience: experienceSummary || (userProfile?.experience != null ? `${userProfile.experience}+ years of experience` : "relevant experience"),
        skills,
      });
      
      setValue("summary", result, { shouldDirty: true, shouldValidate: true });
      toast.success("Professional summary generated!");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = async () => {
    try {
      setIsGenerating(true);

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const lineHeight = 16;
      const maxBottom = pageHeight - margin;

      const toTextLines = (markdown = "") => {
        const cleaned = String(markdown)
          .replace(/```[\s\S]*?```/g, "")
          .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/^>\s?/gm, "")
          .replace(/[*_`]/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        return cleaned.split("\n");
      };

      const lines = toTextLines(previewContent || "");
      let cursorY = margin;

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(17, 24, 39);

      lines.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line || " ", contentWidth);
        wrapped.forEach((wrappedLine) => {
          if (cursorY > maxBottom) {
            pdf.addPage();
            cursorY = margin;
          }

          pdf.text(wrappedLine, margin, cursorY);
          cursorY += lineHeight;
        });

        cursorY += 4;
      });

      pdf.save("resume.pdf");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to download PDF: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async () => {
    try {
      const formattedContent = previewContent.replace(/\n/g, "\n").replace(/\n\s*\n/g, "\n\n").trim();
      await saveResumeFn(previewContent);
      setPreviewContent(formattedContent);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const practiceSkill = (skill) => {
    router.push(`/interview/mock?skill=${encodeURIComponent(skill)}`);
  };

  const markdownComponents = {
    h1: ({ children }) => <h1 style={{ color: "#111827", fontSize: "2rem", fontWeight: 700, margin: "0 0 1rem" }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ color: "#111827", fontSize: "1.25rem", fontWeight: 700, margin: "1.25rem 0 0.75rem" }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ color: "#1f2937", fontSize: "1rem", fontWeight: 700, margin: "1rem 0 0.5rem" }}>{children}</h3>,
    p: ({ children }) => <p style={{ color: "#111827", lineHeight: 1.7, margin: "0 0 0.75rem" }}>{children}</p>,
    a: ({ children, href }) => <a href={href} style={{ color: "#0f766e", textDecoration: "underline" }}>{children}</a>,
    ul: ({ children }) => <ul style={{ color: "#111827", paddingLeft: "1.25rem", margin: "0 0 0.75rem" }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ color: "#111827", paddingLeft: "1.25rem", margin: "0 0 0.75rem" }}>{children}</ol>,
    li: ({ children }) => <li style={{ marginBottom: "0.35rem" }}>{children}</li>,
    strong: ({ children }) => <strong style={{ color: "#111827", fontWeight: 700 }}>{children}</strong>,
    blockquote: ({ children }) => (
      <blockquote style={{ borderLeft: "3px solid #0f766e", paddingLeft: "0.75rem", margin: "0 0 0.75rem", color: "#374151" }}>
        {children}
      </blockquote>
    ),
  };

  return (
    <div data-color-mode="light" className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-2">
        <h1 className="font-bold gradient-title text-5xl md:text-6xl">Resume Builder</h1>
        <div className="space-x-2">
          <Button variant="destructive" onClick={handleSubmit(onSubmit)} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Form</TabsTrigger>
          <TabsTrigger value="preview">Markdown</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input {...register("contactInfo.email")} type="email" placeholder="your@email.com" error={errors.contactInfo?.email} />
                  {errors.contactInfo?.email && <p className="text-sm text-red-500">{errors.contactInfo.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile Number</label>
                  <Input {...register("contactInfo.mobile")} type="tel" placeholder="+1 234 567 8900" />
                  {errors.contactInfo?.mobile && <p className="text-sm text-red-500">{errors.contactInfo.mobile.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">LinkedIn Username</label>
                  <Input {...register("contactInfo.linkedin")} placeholder="your-linkedin-handle" />
                  {errors.contactInfo?.linkedin && <p className="text-sm text-red-500">{errors.contactInfo.linkedin.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">X Username</label>
                  <Input {...register("contactInfo.twitter")} placeholder="your-x-handle" />
                  {errors.contactInfo?.twitter && <p className="text-sm text-red-500">{errors.contactInfo.twitter.message}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Professional Summary</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className="gap-1"
                >
                  {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Auto Generate
                </Button>
              </div>
              <Controller name="summary" control={control} render={({ field }) => <Textarea {...field} className="h-32" placeholder="Write a compelling professional summary or click Auto Generate..." error={errors.summary} />} />
              {errors.summary && <p className="text-sm text-red-500">{errors.summary.message}</p>}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Skills</h3>
              <Controller name="skills" control={control} render={({ field }) => <Textarea {...field} className="h-32" placeholder="List your key skills..." error={errors.skills} />} />
              {errors.skills && <p className="text-sm text-red-500">{errors.skills.message}</p>}
              {(resumeSkills.length > 0 || profileSkills.length > 0) && (
                <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Practice a skill from your resume</p>
                  <div className="flex flex-wrap gap-2">
                    {(resumeSkills.length > 0 ? resumeSkills : profileSkills).map((skill) => (
                      <Button key={skill} type="button" variant="outline" size="sm" onClick={() => practiceSkill(skill)}>
                        {skill}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Work Experience</h3>
              <Controller name="experience" control={control} render={({ field }) => <EntryForm type="Experience" entries={field.value} onChange={field.onChange} />} />
              {errors.experience && <p className="text-sm text-red-500">{errors.experience.message}</p>}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Education</h3>
              <Controller name="education" control={control} render={({ field }) => <EntryForm type="Education" entries={field.value} onChange={field.onChange} />} />
              {errors.education && <p className="text-sm text-red-500">{errors.education.message}</p>}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Projects</h3>
              <Controller name="projects" control={control} render={({ field }) => <EntryForm type="Project" entries={field.value} onChange={field.onChange} />} />
              {errors.projects && <p className="text-sm text-red-500">{errors.projects.message}</p>}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="preview">
          {activeTab === "preview" && (
            <Button variant="link" type="button" className="mb-2" onClick={() => setResumeMode(resumeMode === "preview" ? "edit" : "preview")}>
              {resumeMode === "preview" ? (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Resume
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4" />
                  Show Preview
                </>
              )}
            </Button>
          )}

          {activeTab === "preview" && resumeMode !== "preview" && (
            <div className="flex p-3 gap-2 items-center border-2 border-yellow-600 text-yellow-600 rounded mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">You will lose editied markdown if you update the form data.</span>
            </div>
          )}

          <div className="border rounded-lg">
            <MDEditor value={previewContent} onChange={setPreviewContent} height={800} preview={resumeMode} />
          </div>
          <div style={{ position: "absolute", left: "-10000px", top: 0, width: 0, height: 0, overflow: "hidden" }}>
            <div id="resume-pdf-content" style={{ width: "794px", padding: "24px", background: "#ffffff", color: "#111827" }}>
              <ReactMarkdown components={markdownComponents}>{previewContent || ""}</ReactMarkdown>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}