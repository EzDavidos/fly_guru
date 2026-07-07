"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

// Невидимый компонент-«ловушка меток». Ничего не рисует.
// Задача: при каждом заходе на страницу (и при каждом переходе между страницами
// внутри сайта) заглянуть в адрес и, если там есть метки источника, запомнить их.
// Вставляется один раз в общий layout — работает на всех страницах сразу.
export function Attribution() {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    // pathname в зависимостях — чтобы срабатывало и при переходах без перезагрузки.
  }, [pathname]);

  return null;
}
