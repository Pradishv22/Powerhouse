# PowerWise Canonical Dataset Dictionary

This dictionary defines the standard schema for electricity consumption CSV datasets ingested, processed, and visualized in the PowerWise application.

## Schema Specification

| Column Name | Data Type | Nullable | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `record_id` | String | No | Unique identifier for the reading. Auto-generated if omitted. | `REC-0001` |
| `household_id` | String | No | Pseudonymous identifier for household entity. | `HH-01` |
| `timestamp` | ISO-8601 String | No | Normalized UTC timestamp of measurement (`YYYY-MM-DDTHH:MM:SSZ`). | `2026-09-01T08:00:00Z` |
| `appliance_name` | String | Yes | Name of measured appliance or category. Defaults to `General`. | `Air conditioner` |
| `category` | String | Yes | Appliance category (Cooling, Kitchen, Heating, Lighting, Laundry, Entertainment). | `Cooling` |
| `wattage_w` | Float | Yes | Rated electric power draw in Watts. Must be > 0 if specified. | `1500.0` |
| `usage_hours` | Float | Yes | Operating duration in hours (0.0 to 24.0). | `6.0` |
| `energy_kwh` | Float | No* | Measured or calculated electrical energy in kilowatt-hours. | `9.0` |
| `tariff_per_kwh` | Float | Yes | Applicable tariff rate in Indian Rupees (₹/kWh). Defaults to ₹8.0. | `8.0` |

> \* **Auto-Calculation Rule:** If `energy_kwh` is missing but `wattage_w` and `usage_hours` are present, the system automatically computes:
> $$\text{energy\_kwh} = \frac{\text{wattage\_w} \times \text{usage\_hours}}{1000}$$
> and marks the record as `calculated: true`.

## Integrity Rules
1. `household_id` must be a pseudonymous code (`HH-01`), never personally identifiable information (PII).
2. Readings with negative energy values or usage hours exceeding 24.0 are automatically rejected with line numbers reported in the validation report.
3. CSV export cleanses formula triggers (`=`, `+`, `-`, `@`) to protect downstream users in Excel and Tableau from CSV Formula Injection.
