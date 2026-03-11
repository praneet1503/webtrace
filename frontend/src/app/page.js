"use client";
import { useState, useEffect } from "react";
const API_BASE=process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export default function Home() {
  const [domain, setDomain] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function searchTimeline() {
    if (!domain) return;
    setLoading(true);
    setError(null);
    console.log("searchTimeline ->", domain);

    try {
      const url = `${API_BASE}/timeline?domain=${encodeURIComponent(domain)}`;
      console.log("Fetching URL:", url);
      const res = await fetch(url);
      console.log("Response status:", res.status);
      if (!res.ok) {
        const text = await res.text();
        console.error("Backend error:", res.status, text);
        setError(`Backend error ${res.status}`);
        setTimeline([]);
        return;
      }
      const data = await res.json();
      console.log("Backend data:", data);
      setTimeline(Array.isArray(data.years) ? data.years : []);
    } catch (err) {
      console.error("Failed to fetch timeline:", err);
      setError("Request failed");
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }
//backend status
const [backendStatus,setBackendStatus]=useState("checking...");
useEffect(()=>{
  let mounted = true;
  async function check(){
    try{
      const res = await fetch(`${API_BASE}/health`);
      if (!mounted) return;
      setBackendStatus(res.ok ? "Online": "Error");
    } catch {
      if (!mounted) return;
      setBackendStatus("Offline");
    }
  }
check();
const id = setInterval(check,10000);
return () => {mounted=false;clearInterval(id);};
},[]);
  return (
    <main className="min-h-screen p-10 bg-black text-white flex flex-col">
      <h1 className="text-4xl font-bold mb-4">Webtime, The Archive of websites</h1>
      <p className="text-gray-400 mb-8">It shows you the timeline of the website from start till the end</p>

      <div className="flex gap-3 mb-10">
        <input
          type="text"
          placeholder="Give your website link here"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="px-4 py-2 text-white rounded w-80"
        />
        <button onClick={searchTimeline} className="bg-blue-600 px-4 py-2 rounded">Explore</button>
      </div>

      {loading && <p>Loading timeline(asking aristotle for your websites bro.be patient)</p>}
      {error && <p className="text-red-400">{error}</p>}

      <div className="grid grid-cols-4 gap-4">
        {timeline.map((year) => (
          <div key={year} className="bg-gray-900 p-4 rounded hover:bg-gray-800 cursor-pointer">
            {year}
          </div>
        ))}
      </div>
      
      <div className="flex justify-between items-center mt-8">
        <div>
          <p className="text-white"><strong>Did you Know?</strong></p>
          <p className="text-gray-50 px-2">the first web page was created by tim berners-lee,the creator of the great world wide web</p>
          <p className="text-gray-50 px-4">he basically created the html language.</p>
        </div>
        <div id="backend-status" className="text-white">Backend: {backendStatus}</div>
      </div>

      <footer className="mt-10 text-center text-gray-500 fixed bottom-0 w-full py-20">
        <p>created with ❤️ by praneet (prentz)</p>
      </footer>
    </main>
  );
}