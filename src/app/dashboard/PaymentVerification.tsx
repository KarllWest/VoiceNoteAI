"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL = 3000;

export default function PaymentVerification({ attempt }: { attempt: number }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  useEffect(() => {
    if (attempt >= MAX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("attempt", String(attempt + 1));
      window.location.replace(url.toString());
    }, POLL_INTERVAL);

    return () => clearTimeout(timer);
  }, [attempt]);

  if (attempt >= MAX_ATTEMPTS) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Верифікація займає більше часу</h2>
          <p className="text-gray-400 mb-6">
            Платіж прийнятий, але підтвердження ще обробляється. Зазвичай це займає кілька секунд.
          </p>
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set("attempt", "0");
              window.location.replace(url.toString());
            }}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <CheckCircle className="w-16 h-16 text-green-400" />
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Оплата успішна!</h2>
        <p className="text-gray-400 mb-2">
          Верифікуємо підписку{dots}
        </p>
        <p className="text-xs text-gray-600">
          {attempt > 0 && `Спроба ${attempt}/${MAX_ATTEMPTS}`}
        </p>
      </div>
    </div>
  );
}
