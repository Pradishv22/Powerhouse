import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Snowflake,
  Refrigerator,
  Lightbulb,
  Plug,
  WashingMachine,
  Star,
  type LucideIcon,
} from "lucide-react";
import { recommendations, type Recommendation } from "@/data/mockData";
import { PageHeader, Card, Segmented } from "@/components/ui-kit";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Energy-Saving Recommendations — PowerWise" },
      {
        name: "description",
        content: "Practical, rule-based tips to cut electricity use and bills at home.",
      },
      { property: "og:title", content: "Energy-Saving Tips — PowerWise" },
      { property: "og:description", content: "Easy and high-impact ways to save electricity." },
    ],
  }),
  component: Recommendations,
});

const ICONS: Record<Recommendation["icon"], LucideIcon> = {
  snowflake: Snowflake,
  refrigerator: Refrigerator,
  lightbulb: Lightbulb,
  plug: Plug,
  washing: WashingMachine,
  star: Star,
};
type Filter = "all" | "easy" | "high";

function Recommendations() {
  const [filter, setFilter] = useState<Filter>("all");
  // Easy = difficulty Easy; High impact = 20%+ potential saving
  const visible = recommendations.filter(
    (r) => filter === "all" || (filter === "easy" ? r.difficulty === "Easy" : r.savingsPct >= 20),
  );

  return (
    <>
      <PageHeader
        title="Energy-Saving Recommendations"
        subtitle="Rule-based tips for now — later generated from real consumption analytics."
      >
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "easy", label: "Easy savings" },
            { value: "high", label: "High impact" },
          ]}
        />
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => {
          const Icon = ICONS[r.icon];
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <span className="rounded-xl bg-energy p-2.5 text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.difficulty === "Easy" ? "bg-success-soft text-success" : r.difficulty === "Medium" ? "bg-warning-soft text-foreground" : "bg-secondary text-primary"}`}
                >
                  {r.difficulty}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{r.explanation}</p>
              <p className="mt-4 border-t pt-3 text-sm font-semibold text-success">
                Potential saving: {r.savings}
              </p>
            </Card>
          );
        })}
      </div>
    </>
  );
}
