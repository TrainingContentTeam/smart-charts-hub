import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function AiInsights() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
        <p className="text-muted-foreground">AI-powered analysis of your time data</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-accent" />
          <p className="text-lg font-medium mb-2">Coming Soon</p>
          <p className="text-muted-foreground max-w-md mx-auto">
            AI Insights will analyze your project data and answer questions about your time
            allocation, trends, and productivity patterns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
