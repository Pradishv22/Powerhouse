#!/usr/bin/env python3
"""
PowerWise MapReduce — Phase 1: Mapper
Purpose: Reads electricity consumption CSV records from standard input (stdin)
         and emits a key-value pair for each record: (HouseholdID, Energy_kWh).

Hadoop Streaming format:
   key <tab> value

Explainability Note for College Viva:
   In Hadoop MapReduce, the Mapper processes records independently in parallel.
   It does not perform any aggregation itself; its sole responsibility is to
   extract the grouping key (household_id) and the metric to aggregate (energy_kwh).
"""

import sys

def run_mapper():
    is_first_line = True
    for line_number, line in enumerate(sys.stdin, 1):
        line = line.strip()
        if not line:
            continue

        parts = [p.strip() for p in line.split(",")]

        # Skip header line if present
        if is_first_line:
            is_first_line = False
            if "household_id" in line.lower() or "timestamp" in line.lower():
                continue

        # Canonical CSV schema:
        # 0: record_id, 1: household_id, 2: timestamp, 3: appliance_name,
        # 4: category, 5: wattage_w, 6: usage_hours, 7: energy_kwh, 8: tariff_per_kwh
        #
        # For simplified 3-column input (household, appliance, kwh):
        if len(parts) == 3:
            hh_id, app_name, kwh_str = parts
            try:
                kwh = float(kwh_str)
                if kwh >= 0:
                    print(f"{hh_id}\t{kwh:.3f}")
            except ValueError:
                sys.stderr.write(f"[Mapper Warning] Skipped malformed line {line_number}: {line}\n")
            continue

        if len(parts) >= 8:
            hh_id = parts[1]
            kwh_str = parts[7]
            try:
                kwh = float(kwh_str)
                if kwh >= 0 and hh_id:
                    # Emit key \t value
                    print(f"{hh_id}\t{kwh:.3f}")
                else:
                    sys.stderr.write(f"[Mapper Warning] Negative energy or missing household at line {line_number}\n")
            except ValueError:
                # If energy_kwh is empty, calculate from wattage and usage_hours if present
                try:
                    wattage = float(parts[5])
                    hours = float(parts[6])
                    if wattage > 0 and 0 <= hours <= 24 and hh_id:
                        calc_kwh = (wattage * hours) / 1000.0
                        print(f"{hh_id}\t{calc_kwh:.3f}")
                except (ValueError, IndexError):
                    sys.stderr.write(f"[Mapper Warning] Could not parse numeric fields at line {line_number}\n")
        else:
            sys.stderr.write(f"[Mapper Warning] Line {line_number} has insufficient columns ({len(parts)}), skipping.\n")

if __name__ == "__main__":
    run_mapper()
