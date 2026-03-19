import React from "react";
import { Route, Routes } from "react-router-dom";
import { Stack } from "@mui/material";
import AdminExams from "./admin/AdminExams";
import AdminExamEdit from "./admin/AdminExamEdit";

export default function Admin() {
  return (
    <Stack spacing={2}>
      <Routes>
        <Route path="/" element={<AdminExams />} />
        <Route path="/exams/:examId" element={<AdminExamEdit />} />
      </Routes>
    </Stack>
  );
}

