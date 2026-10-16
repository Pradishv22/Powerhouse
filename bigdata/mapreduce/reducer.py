#!/usr/bin/env python3
"""
PowerWise MapReduce — Phase 2: Reducer
Purpose: Reads sorted (key <tab> value) pairs from standard input (stdin)
         and calculates the total energy consumption (kWh) per household.

Hadoop Streaming contract:
   Between Mapper and Reducer, Hadoop's Shuffle & Sort phase ensures that
   all records with the same key are grouped and delivered consecutively.

Explainability Note for College Viva:
   Because the input is already sorted by key, the Reducer only needs to keep
   track of the `current_key` and its running `current_total`. It does not
   need to store all records in memory, making it highly memory-efficient
   for Big Data processing.
"""

import sys

def run_reducer():
    current_key = None
    current_total = 0.0

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        parts = line.split("\t")
        if len(parts) != 2:
            sys.stderr.write(f"[Reducer Warning] Bad line format: {line}\n")
            continue

        key, value_str = parts
        try:
            val = float(value_str)
        except ValueError:
            sys.stderr.write(f"[Reducer Warning] Invalid numeric value: {value_str}\n")
            continue

        # If we encounter the same key, accumulate the total
        if current_key == key:
            current_total += val
        else:
            # If the key changed and we had an active key, emit its accumulated total
            if current_key is not None:
                print(f"{current_key}\t{current_total:.2f}")
            current_key = key
            current_total = val

    # Don't forget the last key!
    if current_key is not None:
        print(f"{current_key}\t{current_total:.2f}")

if __name__ == "__main__":
    run_reducer()
