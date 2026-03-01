"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Palmtree } from 'lucide-react';
import { Button } from '../components/ui/button';

interface CalendarEvent {
  date: number;
  label: string;
  type: 'holiday' | 'event' | 'weekend';
}

const holidays: CalendarEvent[] = [
  { date: 1, label: 'New Month Kickoff', type: 'event' },
  { date: 14, label: 'Valentine\'s Day', type: 'holiday' },
  { date: 26, label: 'Republic Day', type: 'holiday' },
];

const typeColors = {
  holiday: 'bg-destructive/10 text-destructive border-destructive/20',
  event: 'bg-accent/10 text-accent border-accent/20',
  weekend: 'bg-muted text-muted-foreground border-border',
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(1); // Feb 2026 (0-indexed)
  const [currentYear] = useState(2026);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  const isWeekend = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const getEvent = (day: number) => holidays.find((h) => h.date === day);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-muted-foreground text-sm mt-1">Company calendar with holidays and events</p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => (m === 0 ? 11 : m - 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {monthNames[currentMonth]} {currentYear}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => (m === 11 ? 0 : m + 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="stat-card">
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const event = getEvent(day);
            const weekend = isWeekend(day);
            const isToday = isCurrentMonth && today.getDate() === day;

            return (
              <div
                key={day}
                className={`relative p-2 rounded-lg text-center text-sm min-h-[60px] transition-colors ${
                  isToday
                    ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/30'
                    : weekend
                    ? 'bg-muted/50 text-muted-foreground'
                    : 'hover:bg-muted/30'
                }`}
              >
                {day}
                {event && (
                  <div className={`mt-1 text-[9px] leading-tight rounded px-0.5 ${typeColors[event.type]}`}>
                    {event.label}
                  </div>
                )}
                {weekend && !event && (
                  <div className="text-[9px] text-muted-foreground/50 mt-1">Off</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Holidays */}
      <div className="stat-card">
        <h3 className="font-semibold mb-3">Upcoming Holidays & Events</h3>
        <div className="space-y-2">
          {holidays.map((h, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColors[h.type]}`}>
                {h.type === 'holiday' ? <Palmtree className="w-4 h-4" /> : <Star className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-medium">{h.label}</p>
                <p className="text-xs text-muted-foreground">
                  {monthNames[currentMonth]} {h.date}, {currentYear}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
