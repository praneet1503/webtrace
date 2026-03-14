import Link from "next/link";

export default function AboutPage() {
    return (
        <main className="mx-auto w-full max-w-270 px-6 py-8 text-[#e8e7e3] font-mono">
            <h1 className="mt-4 text-3xl font-bold">About This Project</h1>
            <p className="mt-4 text-lg">
                This project is a personal initiative to explore and visualize the history of websites using the Internet Archive's Wayback Machine. It allows users to see how a website has evolved over time by displaying snapshots taken at different points in history.
            </p>
            <p className="mt-4 text-lg">
                The frontend is built with Next.js, while the backend is powered by FastAPI. The application fetches data from the Wayback Machine API and presents it in an interactive timeline format.
            </p>
            <p className="mt-4 text-lg">
                If you're interested in contributing or have any questions, feel free to check out the <Link href="https://github.com/nasapedia" className="text-blue-500 hover:underline">GitHub repository</Link>.
            </p>
        </main>
    );
}
