import React from "react";
import { Route, Routes } from "react-router-dom";
import { Stack } from "@mui/material";
import AdminHome from "./admin/AdminHome";
import AdminExams from "./admin/AdminExams";
import AdminExamEdit from "./admin/AdminExamEdit";
import AdminUsers from "./admin/AdminUsers";
import AdminPosts from "./admin/AdminPosts";

export default function Admin() {
  return (
    <Stack spacing={2}>
      <Routes>
        <Route path="/" element={<AdminHome />} />
        <Route path="/exams" element={<AdminExams />} />
        <Route path="/exams/:examId" element={<AdminExamEdit />} />
        <Route path="/posts" element={<AdminPosts />} />
        <Route path="/users" element={<AdminUsers />} />
      </Routes>
    </Stack>
  );
}

