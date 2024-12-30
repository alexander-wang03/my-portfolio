import { links } from "./data";

export type SectionName = (typeof links)[number]["name"] | "Contact" | "Skills";
