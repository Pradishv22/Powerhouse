import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { estimateBill, DEFAULT_RATE, formatRupees } from "@/utils/energyCalculations";
import { PageHeader, Card } from "@/components/ui-kit";

export const Route = createFileRoute("/bill-estimator")({
  head: () => ({
    meta: [
      { title: "Bill Estimator — PowerWise" },
      {
        name: "description",
        content: "Estimate your monthly, daily and yearly electricity bill from kWh and rate.",
      },
      { property: "og:title", content: "Electricity Bill Estimator — PowerWise" },
      { property: "og:description", content: "Quickly estimate your electricity bill in rupees." },
    ],
  }),
  component: BillEstimator,
});

function BillEstimator() {
  const [units, setUnits] = useState("300");
  const [rate, setRate] = useState(String(DEFAULT_RATE));

  const kwh = Number(units);
  const r = Number(rate);
  const error =
    units === "" || rate === ""
      ? "Please fill in both fields."
      : !(kwh >= 0)
        ? "Monthly consumption must be 0 or more."
        : !(r > 0 && r <= 100)
          ? "Rate must be between ₹0 and ₹100 per kWh."
          : "";
  const bill = error ? null : estimateBill(kwh, r);

  const input =
    "mt-1 w-full rounded-xl border bg-background px-4 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="Bill Estimator"
        subtitle="Estimated bill = Monthly consumption × Rate per unit."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <label className="text-sm font-medium">Monthly consumption (kWh)</label>
          <input
            className={input}
            type="number"
            min={0}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
          <label className="mt-4 block text-sm font-medium">Rate per unit (₹ / kWh)</label>
          <input
            className={input}
            type="number"
            min={0}
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Default ₹{DEFAULT_RATE}/kWh is illustrative.
          </p>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </Card>
        <div className="fade-up rounded-2xl bg-hero p-6 text-primary-foreground shadow-card">
          <p className="text-sm opacity-80">Estimated monthly bill</p>
          <p className="mt-1 font-display text-5xl font-semibold">
            {bill ? formatRupees(bill.monthly) : "—"}
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-xs opacity-80">Per day</p>
              <p className="font-display text-2xl font-semibold">
                {bill ? formatRupees(bill.daily) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-xs opacity-80">Per year</p>
              <p className="font-display text-2xl font-semibold">
                {bill ? formatRupees(bill.yearly) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Card className="mt-4">
        <div className="flex gap-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          Actual electricity bills may include slab-based rates, fixed charges, taxes and subsidies,
          so your real bill can differ from this flat-rate estimate.
        </div>
      </Card>
    </>
  );
}
