import React from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import App from "./App.jsx";
import "./styles.css";

const theme = extendTheme({
  config: { initialColorMode: "dark", useSystemColorMode: false },
  styles: {
    global: {
      "html, body, #root": { minHeight: "100%", bg: "#202b24" },
      body: { bg: "#202b24", color: "#eee5c8" },
    },
  },
  fonts: {
    heading: "'Courier New', Courier, monospace",
    body: "'Courier New', Courier, monospace",
  },
  colors: {
    brand: {
      50: "#fff8e1",
      100: "#fbecc0",
      200: "#f2dc98",
      300: "#e6c36e",
      400: "#dbb45a",
      500: "#d3a449",
      600: "#b98737",
      700: "#94682f",
      800: "#735028",
      900: "#553b20",
    },
    green: {
      50: "#fff8e1",
      100: "#fbecc0",
      200: "#f2dc98",
      300: "#e6c36e",
      400: "#dbb45a",
      500: "#d3a449",
      600: "#b98737",
      700: "#94682f",
      800: "#735028",
      900: "#553b20",
    },
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
);
