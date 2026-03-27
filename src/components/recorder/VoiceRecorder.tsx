"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, AudioWaveform } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  isAuthenticated: boolean;
  hasPro: boolean;
  freeUsed: number;
}

export default function VoiceRecorder({
  isAuthenticated,
  hasPro,
  freeUsed,
}: VoiceRecorderProps) {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const canRecord = hasPro || freeUsed < 1;

  const startRecording = useCallback(async () => {
    setError("");
    setTranscript("");

    if (!canRecord) {
      if (!isAuthenticated) {
        router.push("/sign-up?redirect=/");
        return;
      }
      router.push("/pay");
      return;
    }

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
      setError("Microphone access denied. Please allow microphone access.");
    }
  }, [canRecord, isAuthenticated, router]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  }, [isRecording]);

  const handleTranscribe = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 402) {
          router.push("/pay");
          return;
        }
        if (res.status === 401) {
          router.push("/sign-up?redirect=/");
          return;
        }
        throw new Error(data.error || "Transcription failed");
      }

      const data = await res.json();
      setTranscript(data.transcript);

      if (data.recordingId) {
        router.push(`/dashboard?recording=${data.recordingId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Free usage indicator */}
      {!hasPro && (
        <div className="text-sm text-gray-500">
          {freeUsed < 1 ? (
            <span className="text-green-600 font-medium">
              1 free recording available
            </span>
          ) : (
            <span className="text-orange-500 font-medium">
              Free recording used — upgrade to continue
            </span>
          )}
        </div>
      )}

      {/* Record button */}
      <div className="relative">
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
        )}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={cn(
            "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
            isRecording
              ? "bg-red-500 hover:bg-red-600 scale-110"
              : canRecord
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gray-400 hover:bg-gray-500",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : isRecording ? (
            <Square className="w-10 h-10 text-white" fill="white" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        {isProcessing
          ? "Transcribing with Whisper AI..."
          : isRecording
          ? "Recording... tap to stop"
          : canRecord
          ? "Tap to start recording"
          : "Upgrade to record more"}
      </p>

      {/* Waveform animation when recording */}
      {isRecording && (
        <div className="flex items-end gap-1 h-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 bg-purple-500 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 24 + 8}px`,
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* Transcript preview */}
      {transcript && (
        <div className="w-full max-w-lg p-4 bg-gray-50 rounded-xl border text-sm text-gray-700">
          <p className="font-medium text-gray-900 mb-1 flex items-center gap-2">
            <AudioWaveform className="w-4 h-4 text-purple-500" />
            Transcript
          </p>
          <p>{transcript}</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center max-w-sm">{error}</p>
      )}

      {/* Upgrade CTA when free limit reached */}
      {!hasPro && freeUsed >= 1 && (
        <Button
          onClick={() =>
            isAuthenticated ? router.push("/pay") : router.push("/sign-up")
          }
          size="lg"
          className="mt-2"
        >
          {isAuthenticated ? "Upgrade to Pro — $9/mo" : "Sign up to continue"}
        </Button>
      )}
    </div>
  );
}
