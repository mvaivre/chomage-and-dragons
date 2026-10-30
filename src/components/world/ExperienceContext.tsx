"use client";
import { createContext, useContext } from "react";
import type { WorldMode } from "@/lib/client/world-mode";
export const ExperienceContext = createContext<WorldMode>("2d");
export const useExperience = () => useContext(ExperienceContext);
