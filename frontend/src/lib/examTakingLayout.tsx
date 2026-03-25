import React, { createContext, useContext, useMemo, useState } from "react";

type ExamTakingLayoutValue = {
  isTakingExam: boolean;
  setTakingExam: (v: boolean) => void;
};

const ExamTakingLayoutContext = createContext<ExamTakingLayoutValue | null>(null);

export function ExamTakingLayoutProvider({ children }: { children: React.ReactNode }) {
  const [isTakingExam, setTakingExam] = useState(false);
  const value = useMemo(() => ({ isTakingExam, setTakingExam }), [isTakingExam]);
  return <ExamTakingLayoutContext.Provider value={value}>{children}</ExamTakingLayoutContext.Provider>;
}

export function useExamTakingLayout() {
  const ctx = useContext(ExamTakingLayoutContext);
  if (!ctx) {
    throw new Error("useExamTakingLayout must be used within ExamTakingLayoutProvider");
  }
  return ctx;
}
