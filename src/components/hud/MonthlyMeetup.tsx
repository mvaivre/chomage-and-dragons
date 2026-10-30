"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { UiIcon } from "./UiIcon";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { MonthlyMeetup as Meetup } from "@/lib/data/types";
import { monthKey, monthLabel } from "@/lib/game/calendar";
import { editableMeetupMonths, meetupDateLabel, meetupLatestInput, monthClosesAt, monthCountdown, shiftMeetupMonth, validateMeetupInput, zurichDateTimeInput, zurichInputToIso, } from "@/lib/game/monthly-meetup";
interface Props {
    meetups: Meetup[];
    playerId: string | null;
    disabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSchedule: (playerId: string, monthKey: string, at: string, place: string) => {
        meetup: Meetup | null;
        rejected?: string;
    };
}
/** The crown's deadline and the drink's date are deliberately separate. */
export function MonthlyMeetup({ meetups, playerId, onSchedule, disabled = false, onOpenChange }: Props) {
    const uiLocale = useLocale();
    const [now, setNow] = useState(() => new Date());
    const [editing, setEditing] = useState<string | null>(null);
    const [date, setDate] = useState("");
    const [place, setPlace] = useState("");
    const [error, setError] = useState<string | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const dateId = useId();
    const placeId = useId();
    const monthId = useId();
    const isEditing = editing !== null;
    const current = monthKey(now);
    const currentMeetup = meetups.find((meetup) => meetup.monthKey === current);
    const previousMeetup = meetups.find((meetup) => meetup.monthKey === shiftMeetupMonth(current, -1) && Date.parse(meetup.at) > now.getTime());
    const availableMonths = editableMeetupMonths(now);
    useEffect(() => {
        const update = () => setNow(new Date());
        const timer = window.setInterval(update, 30000);
        window.addEventListener("focus", update);
        document.addEventListener("visibilitychange", update);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", update);
            document.removeEventListener("visibilitychange", update);
        };
    }, []);
    useEffect(() => {
        onOpenChange?.(isEditing);
        if (!isEditing)
            return;
        dialog.current?.showModal();
        return () => { onOpenChange?.(false); opener.current?.focus(); };
    }, [isEditing, onOpenChange]);
    const fillMonth = (key: string, instant: Date) => {
        const meetup = meetups.find((item) => item.monthKey === key);
        const latest = Date.parse(zurichInputToIso(meetupLatestInput(key))!);
        const suggested = Math.min(latest, Math.max(monthClosesAt(key) - 5 * 3600000, instant.getTime() + 24 * 3600000));
        setEditing(key);
        setDate(meetup ? zurichDateTimeInput(new Date(meetup.at)) : zurichDateTimeInput(new Date(suggested)));
        setPlace(meetup?.place ?? "");
        setError(null);
    };
    const open = (key: string) => {
        const instant = new Date();
        setNow(instant);
        opener.current = document.activeElement as HTMLElement | null;
        fillMonth(key, instant);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!playerId || !editing)
            return;
        const at = zurichInputToIso(date);
        if (!at) {
            setError("Changement d’heure : choisis une autre heure.");
            return;
        }
        const rejected = validateMeetupInput(editing, at, place, new Date());
        if (rejected) {
            setError(rejected);
            return;
        }
        const result = onSchedule(playerId, editing, at, place);
        if (result.rejected) {
            setError(result.rejected);
            return;
        }
        setEditing(null);
    };
    return <>
    <section className="monthly-meetup pointer-events-auto" aria-label={tr("Couronne et verre du mois", undefined, uiLocale)}>
      <div className="monthly-meetup__clock">
        <span>{tr("Couronne · ", undefined, uiLocale)}{tr(monthLabel(current).split(" ")[0], undefined, uiLocale)}</span>
        <time dateTime={new Date(monthClosesAt(current)).toISOString()} title={tr("Clôture du classement à minuit, heure de Zurich", undefined, uiLocale)}>
          {tr(monthCountdown(current, now), undefined, uiLocale)}
        </time>
      </div>
      <button type="button" className="monthly-meetup__date" onClick={() => open(current)} disabled={!playerId || disabled}>
        <UiIcon name="mug" className="monthly-meetup__icon"/>
        <span><small>{tr("Verre du mois", undefined, uiLocale)}</small><b>{tr(currentMeetup ? meetupDateLabel(currentMeetup.at) : "Une date à choisir", undefined, uiLocale)}</b>
          {currentMeetup?.place ? <em>{currentMeetup.place}</em> : null}</span>
        {playerId ? <span className="monthly-meetup__edit">{tr(currentMeetup ? "Changer" : "Fixer", undefined, uiLocale)}</span> : null}
      </button>
      {previousMeetup ? <button type="button" className="monthly-meetup__previous" onClick={() => open(previousMeetup.monthKey)} disabled={!playerId || disabled}>{tr("Verre de ", undefined, uiLocale)}{tr(monthLabel(previousMeetup.monthKey).split(" ")[0], undefined, uiLocale)} · {tr(meetupDateLabel(previousMeetup.at), undefined, uiLocale)}
        {previousMeetup.place ? ` · ${previousMeetup.place}` : ""}
      </button> : null}
    </section>
    {editing !== null ? <dialog className="meetup-editor pointer-events-auto" aria-labelledby={titleId} ref={dialog} onKeyDown={(event) => event.stopPropagation()} onCancel={() => setEditing(null)} onClose={() => setEditing(null)} onClick={(event) => {
                if (event.target !== event.currentTarget)
                    return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
                    setEditing(null);
            }}>
        <div className="meetup-editor__head">
          <h3 id={titleId}>{tr("Verre du mois", undefined, uiLocale)}</h3>
          <button type="button" onClick={() => setEditing(null)} aria-label={tr("Fermer", undefined, uiLocale)}>×</button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor={monthId}>{tr("Mois de la couronne", undefined, uiLocale)}</label>
          <select id={monthId} value={editing} onChange={(event) => fillMonth(event.target.value, new Date())}>
            {availableMonths.map((key) => <option key={key} value={key}>{tr(monthLabel(key), undefined, uiLocale)}</option>)}
          </select>
          <label htmlFor={dateId}>{tr("Date et heure · Zurich", undefined, uiLocale)}</label>
          <input id={dateId} type="datetime-local" value={date} min={zurichDateTimeInput(new Date(now.getTime() + 60000))} max={meetupLatestInput(editing)} step={60} onChange={(event) => setDate(event.target.value)} required autoFocus/>
          <label htmlFor={placeId}>{tr("Lieu ", undefined, uiLocale)}<span>{tr("(facultatif)", undefined, uiLocale)}</span></label>
          <input id={placeId} type="text" value={place} maxLength={80} placeholder={tr("Lieu du rendez-vous", undefined, uiLocale)} onChange={(event) => setPlace(event.target.value)}/>
          <p className="meetup-editor__hint">{tr("Tout le groupe peut modifier ce rendez-vous", undefined, uiLocale)}</p>
          {error ? <p className="meetup-editor__error" role="alert">{tr(error, undefined, uiLocale)}</p> : null}
          <button type="submit" className="meetup-editor__save">{tr(meetups.some((m) => m.monthKey === editing) ? "Changer le rendez-vous" : "Fixer le rendez-vous", undefined, uiLocale)}</button>
        </form>
    </dialog> : null}
  </>;
}
