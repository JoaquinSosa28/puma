"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/schemas";

type TaskTimerContextValue = {
  now: number;
  runningTask: Task | null;
};

const TaskTimerContext = createContext<TaskTimerContextValue>({
  now: Date.now(),
  runningTask: null,
});

export function TaskTimerProvider({
  tasks,
  children,
}: {
  tasks: Task[];
  children: ReactNode;
}) {
  const router = useRouter();
  const runningTask = tasks.find((t) => t.timerStartedAt) ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!runningTask) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [runningTask]);

  useEffect(() => {
    const refresh = () => router.refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return (
    <TaskTimerContext.Provider value={{ now, runningTask }}>
      {children}
    </TaskTimerContext.Provider>
  );
}

export function useTaskTimer() {
  return useContext(TaskTimerContext);
}
