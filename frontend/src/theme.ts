import { createTheme } from "@mui/material/styles";

const fontStack =
  '"K2D", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    background: { default: "#f6f7fb", paper: "#ffffff" }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: fontStack
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale"
        },
        body: {
          fontFamily: fontStack
        }
      }
    }
  }
});

