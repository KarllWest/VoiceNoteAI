"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { Mic, Send, Loader2, AudioWaveform, MessageSquare, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Recording {
  id: string;
  title: string | null;
  transcript: string;
  chatHistory: unknown;
  createdAt: Date;
}

interface DashboardClientProps {
  recordings: Recording[];
  initialRecordingId: string | null;
  userName: string;
  showSuccessBanner: boolean;
}

export default function DashboardClient({
  recordings: initialRecordings,
  initialRecordingId,
  userName,
  showSuccessBanner,
}: DashboardClientProps) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [selectedId, setSelectedId] = useState<string | null>(initialRecordingId);
  const [chatInput, setChatInput] = useState("");
  const [isChating, setIsChating] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [banner, setBanner] = useState(showSuccessBanner);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const selectedRecording = recordings.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedRecording) {
      setChatMessages(selectedRecording.chatHistory as unknown as ChatMessage[]);
    } else {
      setChatMessages([]);
    }
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (banner) {
      const t = setTimeout(() => setBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleTranscribe(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.recordingId) {
        // Refresh recordings list
        const listRes = await fetch("/api/recordings");
        const listData = await listRes.json();
        setRecordings(listData.recordings);
        setSelectedId(data.recordingId);
      }
    } catch {
      alert("Transcription failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedId || isChating) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChating(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: selectedId, message: userMsg }),
      });

      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setIsChating(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-sm">VoiceNote AI</span>
          </div>
          <UserButton />
        </div>

        {/* New recording button */}
        <div className="p-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
              isRecording
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing...</>
            ) : isRecording ? (
              <><AudioWaveform className="w-4 h-4" /> Stop Recording</>
            ) : (
              <><Plus className="w-4 h-4" /> New Recording</>
            )}
          </button>
        </div>

        {/* Recordings list */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wider">
            Recordings ({recordings.length})
          </p>
          {recordings.length === 0 ? (
            <p className="text-xs text-gray-500 px-2 py-4 text-center">
              No recordings yet. Start by recording your voice above.
            </p>
          ) : (
            <ul className="space-y-1 mt-1">
              {recordings.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                      selectedId === r.id
                        ? "bg-purple-600/20 text-purple-300 border border-purple-600/30"
                        : "hover:bg-gray-800 text-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium">
                        {r.title || "Untitled recording"}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-1 opacity-50" />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800">
          <Badge variant="default" className="text-xs">Pro Active</Badge>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        {banner && (
          <div className="bg-green-600/20 border-b border-green-600/30 px-6 py-3 text-sm text-green-400">
            🎉 Welcome to Pro! You now have unlimited recordings and AI chat.
          </div>
        )}

        {!selectedRecording ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Mic className="w-16 h-16 text-gray-700 mb-4" />
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              Welcome, {userName}!
            </h2>
            <p className="text-gray-500 max-w-sm">
              Click &quot;New Recording&quot; to start recording your voice, or select a
              recording from the sidebar to chat about it.
            </p>
          </div>
        ) : (
          <>
            {/* Recording info */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="font-semibold">
                    {selectedRecording.title || "Untitled recording"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {selectedRecording.transcript}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm max-w-sm">
                    Ask GPT-4 anything about this recording — get summaries, action
                    items, insights, translations, and more.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {["Summarize this", "Key action items?", "What topics are discussed?"].map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setChatInput(suggestion)}
                          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
                        >
                          {suggestion}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-xl rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isChating && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-gray-800">
              <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ask about this recording..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder-gray-500"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || isChating}
                  size="icon"
                  className="h-8 w-8 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">
                GPT-4o mini · Powered by OpenAI
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
