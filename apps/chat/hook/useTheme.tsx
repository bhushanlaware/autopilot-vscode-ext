import { createContext } from "react";

export type ThemeType = "dark" | "light";
const themeContext = createContext<ThemeType>("dark");
export const ThemeProvider = themeContext.Provider;
export default themeContext;