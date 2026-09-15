import React, { useState, useEffect } from "react";
import { MeetingReport } from "./types";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  HelpCircle, 
  ShieldCheck, 
  GitFork, 
  User, 
  FileText,
  Calendar,
  Send,
  Search,
  Download,
  Mail,
  History,
  Mic
} from "lucide-react";

// Dynamically resolve API URL with fallback and strip any trailing slashes
const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_BASE_URL = RAW_API_URL.replace(/\/+$/, "");

const DEMO_TRANSCRIPT = `Ravi will complete the API integration by Friday. Priya will test the integration after completion.
We decided to use PostgreSQL for persistence and Redis for agent memory caching.
Amit raised that the third-party billing documentation is incomplete, which may block the subscription checkout module.
Need confirmation on who will write the API documentation.`;

export default function App() {
  const [transcript, setTranscript] = useState(DEMO_TRANSCRIPT);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MeetingReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audio STT State
  const [transcribing, setTranscribing] = useState(false);

  // RAG State
  const [historyQuery, setHistoryQuery] = useState("");
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [ragSources, setRagSources] = useState<string[]>([]);
  const [ragLoading, setRagLoading] = useState(false);

  // Saved Meetings History State
  const [pastMeetings, setPastMeetings] = useState<MeetingReport[]>([]);

  // Fetch list of saved meetings from SQLite
  const fetchPastMeetings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings`);
      if (res.ok) {
        const data = await res.json();
        setPastMeetings(data);
      }
    } catch {
      // Backend may be sleeping or cold on Render free-tier
    }
  };

  useEffect(() => {
    fetchPastMeetings();
  }, []);

  // Audio Upload & Transcription Handler
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTranscribing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Audio transcription failed with status ${res.status}`);
      }

      const data = await res.json();
      setTranscript(data.transcript);
    } catch (err: any) {
      setError(err.message || "Failed to transcribe audio. Please check network connection or backend logs.");
    } finally {
      setTranscribing(false);
      e.target.value = "";
    }
  };

  const handleProcess = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Sprint Planning & Sync",
          transcript: transcript,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `API error: HTTP ${response.status}`);
      }

      const data: MeetingReport = await response.json();
      setReport(data);
      fetchPastMeetings();
    } catch (err: any) {
      setError(
        err.message?.includes("Failed to fetch")
          ? "Failed to connect to backend. If the service was idle, it may take 40-50 seconds to spin up on Render. Please try again in a moment."
          : err.message || "Failed to process transcript."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQueryHistory = async () => {
    if (!historyQuery.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: historyQuery }),
      });
      if (!res.ok) throw new Error("Search query failed");
      const data = await res.json();
      setRagAnswer(data.answer);
      setRagSources(data.sources || []);
    } catch {
      setRagAnswer("Failed to retrieve answers from meeting history.");
    } finally {
      setRagLoading(false);
    }
  };

  // Export tasks as an .ics Calendar File
  const handleDownloadCalendar = () => {
    if (!report || report.action_items.length === 0) return;

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Brightcone//Meeting Intelligence//EN\n";
    report.action_items.forEach((item, idx) => {
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `SUMMARY:Task: ${item.task}\n`;
      icsContent += `DESCRIPTION:Owner: ${item.owner} | Deadline: ${item.deadline} | Priority: ${item.priority}\n`;
      icsContent += `UID:task-${idx}-${Date.now()}@brightcone.ai\n`;
      icsContent += "END:VEVENT\n";
    });
    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `meeting-actions-${report.id.slice(0, 8)}.ics`;
    link.click();
  };

  // Generate Mailto Follow-up Digest
  const handleEmailDigest = () => {
    if (!report) return;
    const subject = encodeURIComponent("Meeting Action Items & Summary Digest");
    const body = encodeURIComponent(
      `Executive Summary:\n${report.summary}\n\nAction Items:\n` +
      report.action_items
        .map((a) => `• [${a.priority}] ${a.task} - Assigned to: ${a.owner} (Due: ${a.deadline})`)
        .join("\n") +
      `\n\nBlockers:\n` +
      report.blockers.map((b) => `⚠️ ${b}`).join("\n")
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              BC
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight leading-tight">
                Brightcone AI • Meeting Intelligence
              </h1>
              <p className="text-xs text-slate-400">Agentic Action Tracking, Groundedness Audit, Multimodal STT & RAG</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pastMeetings.length > 0 && (
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <select
                  aria-label="Select saved meeting"
                  onChange={(e) => {
                    const selected = pastMeetings.find((m) => m.id === e.target.value);
                    if (selected) setReport(selected);
                  }}
                  value={report?.id || ""}
                  className="bg-slate-950 border border-slate-800 rounded-md text-xs py-1 px-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="" disabled>Saved Meetings ({pastMeetings.length})</option>
                  {pastMeetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.summary.slice(0, 35)}... ({m.id.slice(0, 6)})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {report && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {report.processing_status}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Input Panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold flex items-center gap-2 text-slate-200">
              <FileText className="w-4 h-4 text-indigo-400" />
              Raw Meeting Transcript
            </label>
            <div className="flex items-center gap-3">
              {/* Audio Speech-to-Text Upload */}
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 font-medium rounded-lg border border-slate-700 transition">
                {transcribing ? (
                  <>
                    <div className="h-3 w-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span>Transcribing Audio...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload Audio (STT)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  disabled={transcribing || loading}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setTranscript(DEMO_TRANSCRIPT)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                Reset Demo
              </button>
            </div>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            placeholder="Paste your meeting notes or speech-to-text transcript..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono"
          />
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Multi-agent workflow: Parsing → Decisions → Actions & Dependencies → Reviewer Guardrail
            </p>
            <button
              onClick={handleProcess}
              disabled={loading || transcribing || !transcript.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Multi-Agent Graph...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Process Transcript
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </section>

        {/* Meeting-History RAG Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" />
              Query Meeting-History Memory (ChromaDB + RAG)
            </h2>
            <span className="text-[11px] text-slate-500">Cross-meeting semantic retrieval</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQueryHistory()}
              placeholder="e.g., Which database was chosen and who is testing the API?"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              onClick={handleQueryHistory}
              disabled={ragLoading || !historyQuery.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
            >
              {ragLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Ask History
            </button>
          </div>
          {ragAnswer && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="text-xs text-slate-200 leading-relaxed">
                <span className="font-semibold text-indigo-400">RAG Answer: </span>
                {ragAnswer}
              </div>
              {ragSources.length > 0 && (
                <div className="text-[10px] text-slate-500 font-mono">
                  Referenced Meeting IDs: {ragSources.join(", ")}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Results View */}
        {report && (
          <div className="space-y-6">
            {/* Action Bar for Calendar & Email */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-6 py-3 rounded-xl">
              <div className="text-xs text-slate-400">
                Meeting ID: <span className="font-mono text-slate-200">{report.id}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadCalendar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  Export .ics Calendar
                </button>
                <button
                  onClick={handleEmailDigest}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow transition"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Draft Follow-up Email
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Cols: Summary and Actions */}
              <div className="lg:col-span-2 space-y-8">
                {/* Summary Block */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Executive Summary
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {report.summary}
                  </p>

                  <div className="pt-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Key Topics Discussed
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {report.key_topics.map((topic, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-slate-800 border border-slate-700/80 rounded-md text-xs text-slate-300"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Action Items & Dependencies */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                      Action Items & Dependencies ({report.action_items.length})
                    </h2>
                    <span className="text-xs text-slate-500">Automated Dependency Mapping</span>
                  </div>

                  <div className="space-y-4">
                    {report.action_items.map((item, idx) => {
                      const isUnassigned = item.owner.includes("Not Specified");
                      const isNoDeadline = item.deadline.includes("Not Specified");

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-3 hover:border-slate-700 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-medium text-slate-200 leading-snug">
                              {item.task}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded border uppercase font-mono tracking-wider ${
                                item.priority === "High"
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                  : "bg-slate-800 border-slate-700 text-slate-300"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>Owner: </span>
                              <span className={isUnassigned ? "text-amber-400 font-medium" : "text-slate-200"}>
                                {item.owner}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>Deadline: </span>
                              <span className={isNoDeadline ? "text-amber-400 font-medium" : "text-slate-200"}>
                                {item.deadline}
                              </span>
                            </div>
                          </div>

                          {item.dependencies && item.dependencies.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/60">
                              <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium mb-1">
                                <GitFork className="w-3 h-3" />
                                Prerequisites & Dependencies
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {item.dependencies.map((dep, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="text-xs bg-indigo-950/50 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded"
                                  >
                                    {dep}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Right 1 Col: Decisions, Risks, Reviewer Audit */}
              <div className="space-y-6">
                {/* Decisions */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Finalized Decisions
                  </h3>
                  {report.decisions.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No conclusive decisions recorded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.decisions.map((dec, i) => (
                        <li key={i} className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
                          • {dec}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Blockers & Risks */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Identified Blockers & Risks
                  </h3>
                  {report.blockers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No active blockers discovered.</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.blockers.map((blocker, i) => (
                        <li key={i} className="text-xs text-rose-300 bg-rose-500/5 p-2.5 rounded border border-rose-500/20">
                          ⚠️ {blocker}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Open Questions */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    Open Questions
                  </h3>
                  {report.open_questions.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No unresolved questions.</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.open_questions.map((q, i) => (
                        <li key={i} className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
                          ❓ {q}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Follow-up Notes */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-sky-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Follow-up Notes
                  </h3>
                  <ul className="space-y-2">
                    {report.follow_up_notes.map((note, i) => (
                      <li key={i} className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Reviewer Agent Audit Log */}
                <section className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-5 shadow-sm space-y-2">
                  <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    Reviewer Agent Groundedness Audit
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed italic bg-indigo-950/40 p-3 rounded border border-indigo-500/20">
                    "{report.reviewer_audit_log}"
                  </p>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Enforces Brightcone's anti-hallucination constraint.
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}