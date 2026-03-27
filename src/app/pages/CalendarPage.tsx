"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Palmtree, Plus, Loader2, Trash, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { addHoliday, getCalendarEvents, ensureMonthWeekends, getYearHolidays, deleteHoliday } from '../actions/calendar';
import { toast } from 'react-hot-toast';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface CalendarEvent {
  id?: string;
  date: string | Date;
  description: string;
  type: 'holiday' | 'event' | 'weekend';
}

const typeColors = {
  holiday: 'bg-destructive/10 text-destructive border-destructive/20',
  event: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  weekend: 'bg-muted text-muted-foreground border-border',
};

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const role = user?.role;
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear] = useState(new Date().getFullYear());

  // Form state
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: monthData, isLoading: loadingEvents } = useQuery({
    queryKey: ['calendarEvents', currentMonth + 1, currentYear],
    queryFn: () => getCalendarEvents(currentMonth + 1, currentYear),
    enabled: !!user,
  });

  const { data: yearDataRaw, isLoading: loadingHolidays } = useQuery({
    queryKey: ['yearHolidays', currentYear],
    queryFn: () => getYearHolidays(currentYear),
    enabled: !!user,
  });

  const events: CalendarEvent[] = (monthData as any[]) || [];
  const yearHolidays: CalendarEvent[] = useMemo(() => {
    if (!yearDataRaw) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    return (yearDataRaw as any[])
      .filter(h => new Date(h.date).toISOString().split('T')[0] >= todayStr)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [yearDataRaw]);

  useEffect(() => {
    if (user) ensureMonthWeekends(currentMonth + 1, currentYear).catch(() => {});
  }, [currentMonth, currentYear, user]);

  if (authLoading || (loadingEvents && events.length === 0)) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <Skeleton width={120} height={28} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          <Skeleton width={250} height={14} style={{ marginTop: 6 }} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton width={36} height={36} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          <Skeleton width={160} height={22} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          <Skeleton width={36} height={36} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
        </div>
        <div className="stat-card">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`h-${i}`} width="100%" height={14} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={60} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            ))}
          </div>
        </div>
        <div className="stat-card space-y-3">
          <Skeleton width={200} height={18} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton circle width={32} height={32} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              <div className="flex-1">
                <Skeleton width="50%" height={14} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                <Skeleton width="35%" height={12} style={{ marginTop: 4 }} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'hr')) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
        <Palmtree className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">Only Admin and HR can access the company calendar management.</p>
      </div>
    );
  }

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;

    setIsSubmitting(true);
    const res = await addHoliday(holidayDate, holidayName);
    setIsSubmitting(false);

    if (res.success) {
      setHolidayName('');
      setHolidayDate('');
      toast.success('Holiday added successfully');
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['yearHolidays'] });
    } else {
      toast.error(res.error || 'Failed to add holiday');
    }
  };

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

  const getEvent = (day: number) => {
    return events.find((e) => {
      const d = new Date(e.date);
      return (
        d.getDate() === day &&
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear
      );
    });
  };

  const handleDeleteHoliday = async (id: any) => {
    setIsSubmitting(true);
    const res = await deleteHoliday(id);
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Holiday deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['yearHolidays'] });
    } else {
      toast.error(res.error || 'Failed to delete holiday');
    }
  };

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
                className={`relative p-2 rounded-lg text-center text-sm min-h-[60px] transition-colors ${isToday
                  ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/30'
                  : weekend
                    ? 'bg-muted/50 text-muted-foreground'
                    : event ? `${typeColors[event.type]}` : ''}`}
              >
                {day}
                {event && (
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    <div className="text-[10px] leading-tight px-0 font-semibold truncate max-w-full">
                      {event.description}
                    </div>
                  </div>
                )}
                {weekend && !event && (
                  <div className="text-[10px] text-muted-foreground/50 mt-1">Off</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Holiday Section */}
      <div className="stat-card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Holiday
        </h3>
        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Holiday Name (e.g. Diwali)"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            required
          />
          <input
            type="date"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            required
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Holiday
          </Button>
        </form>
      </div>

      {/* Upcoming Holidays */}
      <div className="stat-card">
        <h3 className="font-semibold mb-3">Upcoming Holidays & Events</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {yearHolidays.map((h, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColors[h.type]}`}>
                  {h.type === 'event' ? <Star className="w-4 h-4" /> : <Palmtree className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{h.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              {h.type !== 'event' && (
                <button onClick={() => handleDeleteHoliday(h.id)}>
                  <Trash className="w-4 h-4 hover:text-red-500 transition-colors" />
                </button>
              )}
            </div>
          ))}
          {yearHolidays.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming holidays listed for this year.</p>
          )}
        </div>
      </div>
    </div>
  );
}
