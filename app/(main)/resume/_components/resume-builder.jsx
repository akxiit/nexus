"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Download, Edit, Loader2, Monitor, Save } from "lucide-react";
import { toast } from "sonner";
import MDEditor from "@uiw/react-md-editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { saveResume } from "@/actions/resume";
import { EntryForm } from "./entry-form";
import useFetch from "@/hooks/use-fetch";
import { useUser } from "@clerk/nextjs";
import { entriesToMarkdown } from "@/app/lib/helper";
import { resumeSchema } from "@/app/lib/schema";
import html2pdf from "html2pdf.js/dist/html2pdf.min.js";

export default function ResumeBuilder({ initialContent }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState(initialContent);
  const { user } = useUser();
  const [resumeMode, setResumeMode] = useState("preview");

  const {
    control,
    register,
    handleSubmit,
    watch,
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

  const generatePDF = async () => {
    let tempContainer;

    try {
      setIsGenerating(true);
      const element = document.getElementById("resume-pdf-content");
      if (!element) {
        throw new Error("Resume preview container not found");
      }

      // Render a visible off-screen clone because html2canvas cannot capture display:none content.
      tempContainer = document.createElement("div");
      tempContainer.style.position = "fixed";
      tempContainer.style.top = "0";
      tempContainer.style.left = "-10000px";
      tempContainer.style.width = "794px";
      tempContainer.style.background = "#ffffff";
      tempContainer.style.padding = "24px";
      tempContainer.style.zIndex = "-1";
      tempContainer.appendChild(element.cloneNode(true));
      document.body.appendChild(tempContainer);

      const opt = {
        margin: [15, 15],
        filename: "resume.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(tempContainer).save();
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to download PDF");
    } finally {
      if (tempContainer && document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
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
              <h3 className="text-lg font-medium">Professional Summary</h3>
              <Controller name="summary" control={control} render={({ field }) => <Textarea {...field} className="h-32" placeholder="Write a compelling professional summary..." error={errors.summary} />} />
              {errors.summary && <p className="text-sm text-red-500">{errors.summary.message}</p>}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Skills</h3>
              <Controller name="skills" control={control} render={({ field }) => <Textarea {...field} className="h-32" placeholder="List your key skills..." error={errors.skills} />} />
              {errors.skills && <p className="text-sm text-red-500">{errors.skills.message}</p>}
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
            <div id="resume-pdf-content">
              <MDEditor.Markdown source={previewContent} style={{ background: "white", color: "black" }} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}