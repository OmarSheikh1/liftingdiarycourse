"""Bar chart of exercises logged per day over the past month.

Reads DATABASE_URL from the project's .env, counts workout_exercises per
workout day (workouts.started_at) for the last N days, and saves a PNG.

Usage:
    python plot_workouts.py [--days 30] [--user-id USER_ID] [--output PATH] [--env PATH]
"""

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless: render straight to file
import matplotlib.pyplot as plt
import psycopg
from dotenv import load_dotenv

QUERY = """
    SELECT (w.started_at AT TIME ZONE 'UTC')::date AS day,
           COUNT(we.id) AS exercise_count
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    WHERE (w.started_at AT TIME ZONE 'UTC')::date BETWEEN %(start)s AND %(end)s
      AND (%(user_id)s::text IS NULL OR w.user_id = %(user_id)s::text)
    GROUP BY day
    ORDER BY day
"""


def find_env(start: Path) -> Path | None:
    for folder in [start, *start.parents]:
        candidate = folder / ".env"
        if candidate.is_file():
            return candidate
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=30, help="window length (default 30)")
    parser.add_argument("--user-id", default=None, help="limit to one Clerk user id")
    parser.add_argument("--output", default="workout-exercises-chart.png")
    parser.add_argument("--env", default=None, help="path to .env (default: search upward)")
    args = parser.parse_args()

    env_path = Path(args.env) if args.env else find_env(Path.cwd())
    if not env_path or not env_path.is_file():
        print("ERROR: .env not found", file=sys.stderr)
        return 1
    load_dotenv(env_path)
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL missing from .env", file=sys.stderr)
        return 1

    end = date.today()
    start = end - timedelta(days=args.days - 1)

    # Read-only query; parameters are bound, never interpolated.
    with psycopg.connect(url) as conn:
        rows = conn.execute(
            QUERY, {"start": start, "end": end, "user_id": args.user_id}
        ).fetchall()

    counts = {r[0]: int(r[1]) for r in rows}
    days = [start + timedelta(days=i) for i in range(args.days)]
    values = [counts.get(d, 0) for d in days]

    fig, ax = plt.subplots(figsize=(12, 5), dpi=150)
    ax.bar(range(len(days)), values, color="#2563eb")
    ax.set_xticks(range(len(days)))
    ax.set_xticklabels([str(d.day) for d in days], fontsize=8)
    ax.set_xlabel(f"Day of month ({start:%d %b %Y} – {end:%d %b %Y})")
    ax.set_ylabel("Number of exercises")
    ax.set_title("Exercises logged per day")
    ax.yaxis.get_major_locator().set_params(integer=True)
    ax.set_axisbelow(True)
    ax.grid(axis="y", alpha=0.3)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    fig.tight_layout()

    out = Path(args.output).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out)
    print(f"Saved {out}")
    print(f"Total exercises: {sum(values)} across {sum(1 for v in values if v)} active days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
