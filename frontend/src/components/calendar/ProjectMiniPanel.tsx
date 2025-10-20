"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // :contentReference[oaicite:38]{index=38}
import { Progress } from "@/components/ui/progress"; // :contentReference[oaicite:39]{index=39}

export default function ProjectMiniPanel({ progress=42 }: { progress?: number }) {
  return (
    <Card>
      <CardHeader><CardTitle>Project Timeline (mini)</CardTitle></CardHeader>
      <CardContent>
        <div className="text-sm mb-2">Overall progress</div>
        <Progress value={progress} />
      </CardContent>
    </Card>
  );
}
