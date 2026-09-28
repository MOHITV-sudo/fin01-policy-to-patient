import React, { useState } from "react";
import { MessageSquare, Send, CheckCircle, XCircle, AlertCircle, Bookmark, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export default function PolicyQA({ policyId, onAsk, asking, qaHistory }) {
  const [question, setQuestion] = useState("");
  const [expandedSnippetIdx, setExpandedSnippetIdx] = useState({});

  const SUGGESTED_QUESTIONS = [
    "Is knee replacement covered?",
    "What is the waiting period for pre-existing diseases?",
    "What are the room rent limits?",
    "What procedures have sub-limits?",
    "What are the major exclusions?"
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || asking) return;
    onAsk(question);
    setQuestion("");
  };

  const handlePromptClick = (prompt) => {
    if (asking) return;
    onAsk(prompt);
  };

  const toggleSnippet = (qaIdx, evIdx) => {
    const key = `${qaIdx}-${evIdx}`;
    setExpandedSnippetIdx((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "COVERED":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: "COVERED"
        };
      case "POTENTIALLY_COVERED":
        return {
          bg: "bg-teal-500/10 text-teal-300 border-teal-500/30",
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: "POTENTIALLY COVERED"
        };
      case "NOT_COVERED":
        return {
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: "NOT COVERED"
        };
      case "UNCLEAR":
      default:
        return {
          bg: "bg-slate-700/50 text-slate-300 border-slate-600",
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: "UNCLEAR / INSUFFICIENT INFO"
        };
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            3. Ask Your Policy (Verified Semantic Q&A)
          </h2>
          <p className="text-xs text-slate-400">
            Answers strictly cited from policy pages with evidence snippets
          </p>
        </div>
      </div>

      {/* Suggested prompts pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 text-xs scrollbar-none">
        <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-teal-400" /> Suggested:
        </span>
        {SUGGESTED_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handlePromptClick(q)}
            disabled={asking || !policyId}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-xs disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input box */}
      <form onSubmit={handleSubmit} className="relative mb-4">
        <input
          type="text"
          placeholder={policyId ? "Ask anything about coverage, waiting periods, room rents..." : "Please load or upload a policy first..."}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking || !policyId}
          className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-4 pr-12 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 shadow-inner disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={asking || !question.trim() || !policyId}
          className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold disabled:opacity-40 transition flex items-center justify-center shadow"
        >
          {asking ? (
            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </form>

      {/* Q&A Cards List */}
      <div className="space-y-4 overflow-y-auto max-h-[480px] pr-1">
        {qaHistory.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-slate-400">
              No questions asked yet. Click a suggestion above or enter your question.
            </p>
          </div>
        ) : (
          qaHistory.map((item, qIdx) => {
            const statusInfo = getStatusBadge(item.coverage_status);
            return (
              <div
                key={qIdx}
                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                {/* Header: Question + Coverage Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      Q
                    </span>
                    <span className="text-xs font-semibold text-white">{item.question}</span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.bg}`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        item.confidence === "HIGH"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : item.confidence === "MEDIUM"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                      title={item.confidence_reason}
                    >
                      {item.confidence} CONFIDENCE
                    </span>
                  </div>
                </div>

                {/* Answer prose */}
                <p className="text-xs text-slate-200 leading-relaxed pl-7">{item.answer}</p>

                {/* Conditions & Exclusions tags */}
                {((item.conditions && item.conditions.length > 0) || (item.exclusions && item.exclusions.length > 0)) && (
                  <div className="pl-7 space-y-1.5 pt-1">
                    {item.conditions && item.conditions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-medium text-teal-400">Conditions:</span>
                        {item.conditions.map((cond, i) => (
                          <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                            {cond}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.exclusions && item.exclusions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-medium text-rose-400">Exclusions:</span>
                        {item.exclusions.map((excl, i) => (
                          <span key={i} className="text-[10px] bg-rose-950/20 text-rose-300 px-2 py-0.5 rounded border border-rose-900/40">
                            {excl}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Evidence citations chips */}
                {item.evidence && item.evidence.length > 0 && (
                  <div className="pl-7 pt-2 border-t border-slate-900">
                    <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">
                      Policy Citations:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.evidence.map((ev, evIdx) => {
                        const isExpanded = expandedSnippetIdx[`${qIdx}-${evIdx}`];
                        return (
                          <div key={evIdx} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleSnippet(qIdx, evIdx)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            >
                              <Bookmark className="w-3 h-3 text-teal-400" />
                              <span>Page {ev.page}</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-slate-400 text-[11px] truncate max-w-[140px]">{ev.section}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isExpanded && (
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 max-w-md shadow-lg animate-fadeIn">
                                <span className="font-semibold text-teal-400 block mb-0.5">
                                  Section: {ev.section} (Page {ev.page})
                                </span>
                                <p className="italic text-slate-300">"{ev.snippet}"</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
