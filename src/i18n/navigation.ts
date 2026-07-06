import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Локале-осведомлённые аналоги next/link и next/navigation.
// Используй эти Link/useRouter вместо стандартных — они сами проставляют
// правильный языковой префикс (или опускают его для ru).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
