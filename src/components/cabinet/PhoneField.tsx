"use client";

import { useEffect, useRef, useState } from "react";
import {
  isValidPhone,
  normalizeTelegram,
  PHONE_ERROR,
} from "@/lib/phone";
import {
  lookupClientByPhoneAction,
  type ClientHint,
} from "@/app/[locale]/instructor/actions";

// Поле телефона с двумя обязанностями (пак B, пункты 8 и 10):
//  1) не пропустить мусор вместо номера — подпись и проверка длины;
//  2) как только номер похож на настоящий, спросить у сервера, знаем ли мы
//     этого человека, и показать карточку-подсказку.
//
// Почему подсказка живёт здесь, а не в submit: узнать «он уже у нас, обучение
// пройдено» надо ДО занятия, а не после записи. Инструктор стоит на пляже
// рядом с клиентом — если он поймёт это на полминуты позже, обучение уже
// начнётся.

const DEBOUNCE_MS = 400;

function Hint({ hint }: { hint: ClientHint }) {
  if (!hint.found) return null;

  const facts = [
    hint.trainingDone ? "обучение пройдено" : "обучения ещё не было",
    hint.sessionsCount ? `занятий: ${hint.sessionsCount}` : null,
    hint.minutesLeft && hint.minutesLeft > 0
      ? `абонемент: ${hint.minutesLeft} мин`
      : null,
    hint.tourApproved ? "допущен к выездам" : null,
  ].filter(Boolean);

  return (
    <div className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-sm">
      <p className="font-semibold text-primary">
        Уже в базе: {hint.name}
      </p>
      <p className="mt-0.5 text-xs text-muted">{facts.join(" · ")}</p>
      {hint.trainingDone && (
        <p className="mt-1 text-xs font-medium text-accent-strong">
          Повторное обучение не нужно — выберите прокат.
        </p>
      )}
      {hint.minutesLeft && hint.minutesLeft > 0 ? (
        <p className="mt-1 text-xs font-medium text-accent-strong">
          Есть живой абонемент — возможно, это списание минут, а не оплата.
        </p>
      ) : null}
    </div>
  );
}

export function PhoneField({
  name = "phone",
  defaultValue = "",
  required = true,
  label = "Телефон",
  className,
  showTelegram = true,
  telegramName = "telegramUsername",
  telegramDefault = "",
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  label?: string;
  className: string;
  showTelegram?: boolean;
  telegramName?: string;
  telegramDefault?: string;
}) {
  const [phone, setPhone] = useState(defaultValue);
  const [tg, setTg] = useState(telegramDefault);

  // Ответ храним вместе с номером, по которому его получили, и показываем
  // только при совпадении с текущим. Так подсказка от предыдущего номера
  // гаснет сама при первом же нажатии клавиши — без setState в эффекте,
  // который гонял бы лишний рендер на каждый символ.
  const [result, setResult] = useState<{ phone: string; data: ClientHint } | null>(
    null,
  );

  // Каждый новый запрос отменяет предыдущий: при быстром наборе ответы
  // возвращаются вразнобой, и без этого на экране мог осесть ответ по
  // недонабранному номеру.
  const seq = useRef(0);

  useEffect(() => {
    if (!isValidPhone(phone)) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      lookupClientByPhoneAction(phone)
        .then((res) => {
          if (mine === seq.current) setResult({ phone, data: res });
        })
        .catch(() => {
          // Подсказка — удобство, а не часть записи: молча гаснет, форма
          // продолжает работать.
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [phone]);

  const hint = result && result.phone === phone ? result.data : null;

  const touched = phone.trim().length > 0;
  const bad = touched && !isValidPhone(phone);
  const tgBad = tg.trim().length > 0 && normalizeTelegram(tg) === null;

  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {label} {required && "*"}
        </span>
        <input
          type="tel"
          name={name}
          required={required}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901234567"
          aria-invalid={bad || undefined}
          className={className}
        />
      </label>
      <p className="mt-1 text-xs text-muted">
        Номер для WhatsApp или Telegram — по нему будем связываться.
      </p>
      {bad && <p className="mt-1 text-xs text-red-600">{PHONE_ERROR}</p>}

      {hint && <Hint hint={hint} />}

      {showTelegram && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">
            Ник в Telegram
            <span className="font-normal text-muted"> · необязательно</span>
          </span>
          <input
            type="text"
            name={telegramName}
            value={tg}
            onChange={(e) => setTg(e.target.value)}
            placeholder="@nickname"
            autoCapitalize="off"
            autoCorrect="off"
            className={className}
          />
          {tgBad && (
            <span className="mt-1 block text-xs text-red-600">
              Ник — 5–32 символа: буквы, цифры, подчёркивание.
            </span>
          )}
        </label>
      )}
    </div>
  );
}
