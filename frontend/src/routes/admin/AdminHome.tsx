import React from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { SvgIconComponent } from "@mui/icons-material";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";

type FeatureTheme = {
  main: string;
};

const FEATURES: Array<{
  to: string;
  title: string;
  description: string;
  Icon: SvgIconComponent;
  theme: FeatureTheme;
}> = [
  {
    to: "/admin/exams",
    title: "Đề thi",
    description:
      "Tạo và chỉnh sửa đề, câu hỏi trắc nghiệm và đúng/sai, xuất bản, xem lượt làm và chi tiết bài làm.",
    Icon: AssignmentOutlinedIcon,
    theme: { main: "#1565c0" }
  },
  {
    to: "/admin/users",
    title: "Người dùng",
    description: "Danh sách tài khoản, cập nhật họ tên, phân quyền quản trị và theo dõi hoạt động.",
    Icon: GroupsOutlinedIcon,
    theme: { main: "#6a1b9a" }
  }
];

export default function AdminHome() {
  const muiTheme = useTheme();

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>
          Quản trị hệ thống
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {FEATURES.map(({ to, title, description, Icon, theme: ft }) => {
          const main = ft.main;
          const iconBg = alpha(main, 0.12);
          const borderSoft = alpha(main, 0.22);

          return (
            <Grid item xs={12} sm={6} key={to}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  borderRadius: 1,
                  borderColor: alpha(main, 0.18),
                  bgcolor: muiTheme.palette.background.paper,
                  transition: muiTheme.transitions.create(["border-color", "background-color"], {
                    duration: muiTheme.transitions.duration.shorter
                  }),
                  "&:hover": {
                    borderColor: borderSoft,
                    bgcolor: alpha(main, 0.03)
                  }
                }}
              >
                <CardActionArea
                  component={Link}
                  to={to}
                  sx={{
                    height: "100%",
                    alignItems: "stretch",
                    py: 0,
                    "&:hover .MuiCardActionArea-focusHighlight": { opacity: 0 }
                  }}
                >
                  <CardContent sx={{ py: 2.5, px: 2.25 }}>
                    <Stack spacing={1.75} alignItems="center" textAlign="center">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1,
                          bgcolor: iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: `1px solid ${alpha(main, 0.08)}`
                        }}
                      >
                        <Icon sx={{ fontSize: 26, color: main }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={800} color="text.primary" letterSpacing={-0.2}>
                        {title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.65, maxWidth: 320, mx: "auto" }}
                      >
                        {description}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
