import { useEffect, useState, useCallback, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react";
import { defaultAppliances, type Appliance } from "@/data/mockData";
import {
  dailyEnergyKwh,
  monthlyEnergyKwh,
  energyCost,
  percentOf,
  DEFAULT_RATE,
  formatRupees,
} from "@/utils/energyCalculations";
import { PageHeader, Card } from "@/components/ui-kit";
import { getAppliances, createAppliance, updateAppliance, deleteAppliance } from "@/services/api";

export const Route = createFileRoute("/appliances")({
  head: () => ({
    meta: [
      { title: "Appliance Analysis — PowerWise" },
      {
        name: "description",
        content: "Calculate daily and monthly energy use and cost for each household appliance.",
      },
      { property: "og:title", content: "Appliance Analysis — PowerWise" },
      {
        property: "og:description",
        content: "See which appliances use the most electricity and what they cost.",
      },
    ],
  }),
  component: Appliances,
});

const emptyForm = { name: "", category: "", watts: "", hours: "" };

function Appliances() {
  const [appliances, setAppliances] = useState<Appliance[]>(defaultAppliances);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isServerSynced, setIsServerSynced] = useState(false);

  const fetchAppliances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppliances(rate);
      setAppliances(data);
      setIsServerSynced(true);
    } catch {
      setIsServerSynced(false);
    } finally {
      setLoading(false);
    }
  }, [rate]);

  useEffect(() => {
    fetchAppliances();
  }, [fetchAppliances]);

  // Calculate energy for every appliance
  const rows = appliances.map((a) => {
    const daily = dailyEnergyKwh(a.watts, a.hours);
    const monthly = monthlyEnergyKwh(daily);
    return { ...a, daily, monthly, cost: energyCost(monthly, rate) };
  });
  const totalMonthly = rows.reduce((s, r) => s + r.monthly, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const watts = Number(form.watts);
    const hours = Number(form.hours);
    if (!form.name.trim()) return setError("Please enter an appliance name.");
    if (!(watts > 0 && watts <= 10000)) return setError("Wattage must be between 1 and 10,000 W.");
    if (!(hours > 0 && hours <= 24)) return setError("Daily usage must be between 0 and 24 hours.");
    setError("");

    try {
      await createAppliance({
        name: form.name.trim(),
        category: form.category.trim() || "Other",
        watts,
        hours,
      });
      await fetchAppliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the appliance.");
      return;
    }
    setForm(emptyForm);
  }

  async function handleDelete(id: string) {
    try {
      await deleteAppliance(id);
      await fetchAppliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the appliance.");
    }
  }

  async function handleEdit(appliance: Appliance) {
    const name = window.prompt("Appliance name", appliance.name);
    if (name === null) return;
    const watts = window.prompt("Wattage (W)", String(appliance.watts));
    const hours = window.prompt("Hours per day", String(appliance.hours));
    if (!name.trim() || watts === null || hours === null) return;
    try {
      await updateAppliance(appliance.id, { name: name.trim(), watts: Number(watts), hours: Number(hours) });
      await fetchAppliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the appliance.");
    }
  }

  const input =
    "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="Appliance Analysis"
        subtitle="Daily energy = Wattage × Hours ÷ 1000 · Monthly = Daily × 30 · Cost = Monthly × Rate"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isServerSynced ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
        >
          {isServerSynced ? "Server Synced (RBAC)" : "Local Demo Mode"}
        </span>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-4 text-base font-semibold">Add an appliance</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className={input}
              placeholder="Name (e.g. Microwave)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={input}
              placeholder="Category (e.g. Kitchen)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={input}
                type="number"
                placeholder="Watts"
                value={form.watts}
                onChange={(e) => setForm({ ...form, watts: e.target.value })}
              />
              <input
                className={input}
                type="number"
                step="0.1"
                placeholder="Hours / day"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> Add appliance
            </button>
          </form>
          <div className="mt-5 border-t pt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Electricity rate (₹ / kWh)
            </label>
            <input
              className={`${input} mt-1`}
              type="number"
              min={0}
              step="0.5"
              value={rate}
              onChange={(e) => setRate(Math.max(0, Number(e.target.value)))}
            />
            <button
              onClick={() => fetchAppliances()}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh appliances
            </button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-semibold">Appliances ({rows.length})</h3>
            <p className="text-sm text-muted-foreground">
              Total: <b className="text-foreground">{totalMonthly.toFixed(1)} kWh</b> ·{" "}
              {formatRupees(energyCost(totalMonthly, rate))}/mo
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No appliances yet. Add one using the form.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Appliance</th>
                    <th>Watts</th>
                    <th>Hrs/day</th>
                    <th>kWh/day</th>
                    <th>kWh/mo</th>
                    <th>₹/mo</th>
                    <th>Share</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const share = percentOf(r.monthly, totalMonthly);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="py-2.5">
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.category}</p>
                        </td>
                        <td>{r.watts}</td>
                        <td>{r.hours}</td>
                        <td>{r.daily.toFixed(2)}</td>
                        <td>{r.monthly.toFixed(1)}</td>
                        <td className="font-medium">{formatRupees(r.cost)}</td>
                        <td className="min-w-24">
                          <div className="h-1.5 rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-success"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                        </td>
                        <td>
                          <button
                            aria-label={`Edit ${r.name}`}
                            onClick={() => handleEdit(r)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            aria-label={`Remove ${r.name}`}
                            onClick={() => handleDelete(r.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
