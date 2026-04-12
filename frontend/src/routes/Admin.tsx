import React from "react";
import { Route, Routes } from "react-router-dom";
import { Stack } from "@mui/material";
import AdminHome from "./admin/AdminHome";
import AdminExams from "./admin/AdminExams";
import AdminExamEdit from "./admin/AdminExamEdit";
import AdminUsers from "./admin/AdminUsers";

export default function Admin() {
  return (
    <Stack
      spacing={2}
      sx={{
        "& .MuiCard-root": { borderRadius: 1 },
        "& .MuiTableContainer-root": { borderRadius: 1 }
      }}
    >
      <Routes>
        <Route path="/" element={<AdminHome />} />
        <Route path="/exams" element={<AdminExams />} />
        <Route path="/exams/:examId" element={<AdminExamEdit />} />
        <Route path="/users" element={<AdminUsers />} />
      </Routes>
    </Stack>
  );
}

