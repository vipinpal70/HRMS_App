"use client";

import { useEffect, useState } from 'react';
import { Mail, Shield, Loader2, User, Search, X, Phone, Calendar, Users } from 'lucide-react';
import { getEmployees, Profile } from '@/app/actions/profile';
import Link from 'next/link';

export default function TeamPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      const data = await getEmployees();
      setEmployees(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredEmployees = q
    ? employees.filter(emp =>
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q)
    )
    : employees;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-8 animate-fade-up max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Team Members</h1>
          </div>
          <p className="text-muted-foreground text-sm">Meet the amazing people behind our success</p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search team members..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-input bg-background/50 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredEmployees.map((emp) => (
          <Link
            key={emp.id}
            href={`/profile/${emp.id}`}
            className="group relative bg-card hover:bg-accent/5 border border-border/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-500" />
            
            <div className="relative flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold text-xl shadow-inner overflow-hidden border-2 border-background">
                  {emp.avatar ? (
                    <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    emp.name.split(' ').map(n => n[0]).join('')
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-background shadow-sm border border-border flex items-center justify-center">
                  <Shield className="w-3 h-3 text-primary" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{emp.name}</h3>
                <p className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary w-fit mx-auto uppercase tracking-wider">
                  {emp.designation || 'Team Member'}
                </p>
              </div>

              <div className="w-full pt-4 border-t border-border/50 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[180px]">{emp.email}</span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>DOB: {formatDate(emp.dob)}</span>
                </div>

                {emp.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{emp.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border/50">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground">No team members found</h3>
          <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">
            {searchQuery ? `We couldn't find any results for "${searchQuery}"` : "It looks like there aren't any members in this team yet."}
          </p>
        </div>
      )}
    </div>
  );
}
