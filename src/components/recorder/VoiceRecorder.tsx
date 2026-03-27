"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, AudioWaveform, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  isAuthenticated: boolean;
  hasPro: boolean;
  freeUsed: number;
}

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canRecord = hasPro || freeUsed < 1;

  const checkAccess = () => {
    if (!canRecord) {
      if (!isAuthenticated) {
        router.push("/sign-up");
        return false;
      }
      router.push("/pay");
      return false;
    }
    return true;
  };

  const startRecording = useCallback(async () => {
    setError("");
    setTranscript("");
    if (!checkAccess()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mediaRecorder.mimeType || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        await handleTranscribe(blob, `recording.${ext}`);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch {
      setError("Мікрофон недоступний. Дозволь доступ у браузері.");
    }
  }, [canRecord, isAuthenticated]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  }, [isRecording]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setTranscript("");
    if (!checkAccess()) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["audio/", "video/mp4", "video/mpeg"];
    if (!allowed.some((t) => file.type.startsWith(t))) {
      setError("Підтримуються: mp3, wav, m4a, ogg, webm, flac");
      return;
    }

    setIsProcessing(true);
    await handleTranscribe(file, file.name);
    e.target.value = "";
  };

  const handleTranscribe = async (blob: Blob | File, filename: string) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, filename);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) { router.push("/pay"); return; }
        if (res.status === 401) { router.push("/sign-up"); return; }
        throw new Error(data.error || "Transcription failed");
      }

      setTranscript(data.transcript);
      if (data.recordingId) {
        router.push(`/dashboard?recording=${data.recordingId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Щось пішло не так");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Free usage indicator */}
      {!hasPro && (
        <div className="text-sm">
          {freeUsed < 1 ? (
            <span className="text-green-400 font-medium">1 безкоштовний запис</span>
          ) : (
            <span className="text-orange-400 font-medium">Ліміт вичерпано — потрібен Pro</span>
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
            isRecording ? "bg-red-500 hover:bg-red-600 scale-110"
              : canRecord ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gray-500 hover:bg-gray-600",
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

      <p className="text-sm text-gray-400">
        {isProcessing ? "Транскрибуємо через Whisper AI..."
          : isRecording ? "Запис... натисни щоб зупинити"
          : canRecord ? "Натисни щоб почати запис"
          : "Потрібен Pro для запису"}
      </p>

      {/* Waveform */}
      {isRecording && (
        <div className="flex items-end gap-1 h-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 bg-purple-400 rounded-full animate-pulse"
              style={{ height: `${[16, 24, 12, 20, 14][i]}px`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-gray-500">або</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* File upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
        onChange={handleFileUpload}
        className="hidden"
        disabled={isProcessing}
      />
      <button
        onClick={() => checkAccess() && fileInputRef.current?.click()}
        disabled={isProcessing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-sm text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        Завантажити аудіо файл
      </button>
      <p className="text-xs text-gray-600 -mt-4">mp3, wav, m4a, ogg, webm, flac</p>

      {/* Transcript */}
      {transcript && (
        <div className="w-full p-4 bg-white/5 rounded-xl border border-white/10 text-sm text-gray-300">
          <p className="font-medium text-white mb-1 flex items-center gap-2">
            <AudioWaveform className="w-4 h-4 text-purple-400" />
            Транскрипт
          </p>
          <p>{transcript}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      {!hasPro && freeUsed >= 1 && (
        <Button
          onClick={() => isAuthenticated ? router.push("/pay") : router.push("/sign-up")}
          size="lg"
        >
          {isAuthenticated ? "Оновити до Pro — $9/міс" : "Зареєструватись"}
        </Button>
      )}
    </div>
  );
}
