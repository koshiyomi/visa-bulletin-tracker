#!/usr/bin/env python3
"""
Export visa bulletin data to CSV files.
"""

import sqlite3
import pandas as pd
from pathlib import Path

DB_PATH = Path(__file__).parent / "visa_bulletin.db"
OUTPUT_DIR = Path(__file__).parent / "exports"


def export_all():
    """Export all data to various CSV formats."""
    OUTPUT_DIR.mkdir(exist_ok=True)

    conn = sqlite3.connect(DB_PATH)

    # Full export
    df = pd.read_sql_query(
        "SELECT * FROM visa_bulletin ORDER BY bulletin_date DESC, table_type, category, country",
        conn,
    )
    df.to_csv(OUTPUT_DIR / "visa_bulletin_all.csv", index=False)
    print(f"Exported {len(df)} records to visa_bulletin_all.csv")

    # Pivot: Final Action by Country
    for table_type in ["Final_Action", "Dates_for_Filing"]:
        for country in [
            "India",
            "China",
            "All_Chargeability_Areas",
            "Mexico",
            "Philippines",
        ]:
            query = f"""
                SELECT bulletin_date, category, priority_date
                FROM visa_bulletin
                WHERE table_type = '{table_type}' AND country = '{country}'
                ORDER BY bulletin_date
            """
            df = pd.read_sql_query(query, conn)
            if len(df) > 0:
                pivot = df.pivot(
                    index="bulletin_date", columns="category", values="priority_date"
                )
                safe_country = country.replace("/", "_")
                pivot.to_csv(OUTPUT_DIR / f"{table_type}_{safe_country}.csv")
                print(f"Exported {table_type}_{safe_country}.csv ({len(pivot)} rows)")

    # Summary by year
    query = """
        SELECT 
            substr(bulletin_date, 1, 4) as year,
            table_type,
            country,
            category,
            MIN(priority_date) as earliest_date,
            MAX(priority_date) as latest_date,
            COUNT(*) as records
        FROM visa_bulletin
        WHERE priority_date NOT IN ('CURRENT', 'UNAVAILABLE')
        GROUP BY 1, 2, 3, 4
        ORDER BY 1 DESC, 2, 3, 4
    """
    df = pd.read_sql_query(query, conn)
    df.to_csv(OUTPUT_DIR / "yearly_summary.csv", index=False)
    print(f"Exported yearly_summary.csv")

    conn.close()
    print(f"\nAll exports saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    export_all()
