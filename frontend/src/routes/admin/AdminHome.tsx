import React from "react";
import { Link } from "react-router-dom";
import { Card, CardActionArea, CardContent, Grid, Stack, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";

export default function AdminHome() {
  return (
    <Stack spacing={0}>
      <Typography variant="h6" fontWeight={800}>
        Quản trị hệ thống
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardActionArea component={Link} to="/admin/exams">
              <CardContent>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <DescriptionOutlinedIcon fontSize="large" />
                  <Typography fontWeight={800}>Đề thi</Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardActionArea component={Link} to="/admin/users">
              <CardContent>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <PeopleOutlineOutlinedIcon fontSize="large" />
                  <Typography fontWeight={800}>Người dùng</Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardActionArea component={Link} to="/admin/posts">
              <CardContent>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <ArticleOutlinedIcon fontSize="large" />
                  <Typography fontWeight={800}>Bài viết</Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

