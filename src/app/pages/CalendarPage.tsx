"use client";

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Palmtree, Plus, Loader2, Trash } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { addHoliday, getCalendarEvents, ensureMonthWeekends, getYearHolidays, deleteHoliday } from '../actions/calendar';
import { toast } from 'react-hot-toast';

interface CalendarEvent {
  id?: string;
  date: string | Date;
  description: string;
  type: 'holiday' | 'event' | 'weekend';
}

const typeColors = {
  holiday: 'bg-destructive/10 text-destructive border-destructive/20',
  event: 'bg-accent/10 text-accent border-accent/20',
  weekend: 'bg-muted text-muted-foreground border-border',
};

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const role = user?.role;
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [yearHolidays, setYearHolidays] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);
      try {
        // Ensure weekends are there (doesn't overwrite existing holidays now)
        await ensureMonthWeekends(currentMonth + 1, currentYear);

        // Fetch month events (for grid)
        const monthData = await getCalendarEvents(currentMonth + 1, currentYear);
        setEvents(monthData as any);

        // Fetch year holidays (for upcoming list)
        const yearData = await getYearHolidays(currentYear);
        // Filter for upcoming (today or later) and sort
        const todayStr = new Date().toISOString().split('T')[0];
        const upcomingHolidays = yearData
          .filter(h => new Date(h.date).toISOString().split('T')[0] >= todayStr)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setYearHolidays(upcomingHolidays as any);
      } catch (err) {
        console.error('Failed to load calendar events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentMonth, currentYear, user]);

  if (authLoading || (loading && events.length === 0)) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      // Refresh all data
      const monthData = await getCalendarEvents(currentMonth + 1, currentYear);
      setEvents(monthData as any);
      const yearData = await getYearHolidays(currentYear);
      const todayStr = new Date().toISOString().split('T')[0];
      setYearHolidays(yearData.filter(h => h.date.toString() >= todayStr) as any);
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
      // Refresh all data
      const monthData = await getCalendarEvents(currentMonth + 1, currentYear);
      setEvents(monthData as any);
      const yearData = await getYearHolidays(currentYear);
      const todayStr = new Date().toISOString().split('T')[0];
      setYearHolidays(yearData.filter(h => h.date.toString() >= todayStr) as any);
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
                  <div className={`mt-1 text-[10px] leading-tight px-0 font-semibold`}>
                    {event.description}
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
        <div className="space-y-2">
          {yearHolidays.map((h, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColors[h.type]}`}>
                  <Palmtree className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{h.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDeleteHoliday(h.id)}>
                <Trash className="w-4 h-4 hover:text-red-500" />
              </button>
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
