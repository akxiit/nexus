import { AlertTriangle, ArrowDownRight, ArrowUpRight, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerformanceInsights({ insights }) {
  if (!insights) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="gradient-title text-3xl md:text-4xl">Performance Insights</CardTitle>
        <CardDescription>What your quiz trend says about your next focus area</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <p className="font-medium">Summary</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{insights.summary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Weakest stack</p>
            <p className="mt-1 text-lg font-semibold">{insights.weakArea || "Not enough data yet"}</p>
            {insights.weakAreaScore != null && (
              <p className="text-sm text-muted-foreground">Average score: {insights.weakAreaScore}%</p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trend</p>
            <div className="mt-1 flex items-center gap-2">
              {insights.trendDelta != null ? (
                insights.trendDelta >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )
              ) : (
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-lg font-semibold capitalize">{insights.trendLabel || "Not enough data yet"}</p>
            </div>
            {insights.trendDelta != null && (
              <p className="text-sm text-muted-foreground">
                {insights.trendDelta >= 0 ? "+" : ""}{insights.trendDelta.toFixed(1)} points compared with the previous set of quizzes
              </p>
            )}
          </div>
        </div>

        {Array.isArray(insights.mistakes) && insights.mistakes.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">Recurring mistakes</p>
            <div className="space-y-2">
              {insights.mistakes.map((mistake) => (
                <div key={mistake.topic} className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium">{mistake.topic}</p>
                  <p className="text-sm text-muted-foreground">{mistake.note}</p>
                  <p className="text-xs text-muted-foreground">Missed in {mistake.count} question{mistake.count === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}