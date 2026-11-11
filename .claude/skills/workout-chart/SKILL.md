---
name: workout-chart
description: Query the lifting diary database for the past month of workout entries and plot a bar chart (x = day of month, y = number of exercises) exported as a PNG image. Use when the user asks for a workout chart, monthly workout activity, exercises-per-day graph, or a chart/image of their recent training data.
---

# Workout chart

Generates a bar chart image of how many exercises were logged each day over the past month.

## How it works

`scripts/plot_workouts.py`:

1. Finds the project `.env` (searches upward from the current directory) and reads `DATABASE_URL`. Never print or echo this value.
2. Runs one read-only, parameterised SQL query joining `workouts` and `workout_exercises`, counting exercises per day (`workouts.started_at`, UTC) for the last 30 days including today.
3. Fills days with no workouts with 0 and draws the bar chart with matplotlib (x axis: day of month, y axis: number of exercises).
4. Saves a PNG and prints its absolute path plus totals.

## Usage

Run from the project root:

```bash
python .claude/skills/workout-chart/scripts/plot_workouts.py --output workout-exercises-chart.png
```

Options:

- `--days N` window length (default 30)
- `--user-id ID` restrict to one Clerk user id (default: all users)
- `--output PATH` image path (default `workout-exercises-chart.png` in the current directory)
- `--env PATH` explicit `.env` location

## Requirements

Python packages: `psycopg[binary]`, `python-dotenv`, `matplotlib`. If missing: `pip install "psycopg[binary]" python-dotenv matplotlib`.

## After running

Tell the user the saved image path and the totals line. If the query fails, report the error without including the connection string.
