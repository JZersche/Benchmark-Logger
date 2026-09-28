# Benchmark Logger

A small browser tool for recording benchmark results (for example PassMark's MemoryMark
and CPUMark) and comparing runs, such as a memory benchmark with XMP on and off.

## Running it

It has no dependencies and no build step. Open `index.html` in a browser, or serve the
folder with any static file server (for example `python3 -m http.server`).

## Features

- **Log a benchmark group:** a name, an optional overall score, a note, the XMP/tRAS
  memory settings, and any number of labelled metrics. Presets fill in the metric names
  for MemoryMark and CPUMark.
- **Bar graph:** every group's metrics are drawn on a shared log scale, so very small and
  very large values both stay readable. Metrics marked *lower is better*
  (e.g. Memory Latency) are drawn in orange.
- **Edit and delete** any logged group. Each entry records when it was added.
- **Compare:** tick *Compare* on two or more groups to see each metric side by side, with
  the percentage difference from the first selected group (the baseline). Green means
  better and red means worse, taking *lower is better* into account.
- **Saving:** data is kept in the browser's `localStorage`. It stays on that browser and
  device, and clearing site data removes it.
- **Export / import:** save everything as JSON or CSV, and import either format again.
  Groups whose `id` is already present are skipped, so importing the same file twice
  does not create duplicates.

## CSV format

One row per metric; the group's fields repeat on each of its rows:

```
id,createdAt,groupName,groupValue,groupNote,XMP,tRAS,metric,value,lowerIsBetter
```

Only `groupName` is required when importing. Rows without an `id` are grouped by
`createdAt` + `groupName`.
