"use client";

export default function TimelineGrid({
    years,
    selectedYear,
    onScrubYear,
    onSelectYear,
    onStepYear,
    onTogglePlay,
    isPlaying,
}) {
    if (!years || years.length === 0) {
        return null;
    }

    const selectedIndex = Math.max(0, years.indexOf(String(selectedYear)));
    const firstYear = years[0];
    const latestYear = years[years.length - 1];

    return (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-100">Website history timeline</h2>
                <button
                    type="button"
                    onClick={onTogglePlay}
                    className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-semibold tracking-wide text-zinc-200 hover:border-zinc-500"
                >
                    {isPlaying ? "STOP" : "PLAY HISTORY"}
                </button>
            </div>

            <div
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                onWheel={(event) => {
                    event.preventDefault();
                    onStepYear(event.deltaY > 0 ? 1 : -1);
                }}
            >
                <input
                    aria-label="Timeline year"
                    type="range"
                    min={0}
                    max={Math.max(0, years.length - 1)}
                    value={selectedIndex}
                    onChange={(event) => {
                        const nextIndex = Number(event.target.value);
                        onScrubYear(years[nextIndex]);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowRight") onStepYear(1);
                        if (event.key === "ArrowLeft") onStepYear(-1);
                    }}
                    className="w-full"
                />

                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {years.map((year) => {
                        const isActive = String(selectedYear) === String(year);
                        return (
                            <button
                                key={year}
                                type="button"
                                onClick={() => onSelectYear(year)}
                                className={`rounded-md border px-3 py-1 text-sm transition ${
                                    isActive
                                        ? "border-sky-500 bg-sky-500/20 text-sky-200"
                                        : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                                }`}
                            >
                                {year}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                <p>First snapshot: {firstYear}</p>
                <p>Latest snapshot: {latestYear}</p>
            </div>
        </section>
    );
}