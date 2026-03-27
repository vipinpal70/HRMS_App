"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Shield, User, Search, X, Phone, Calendar, Users } from 'lucide-react';
import { apiGet } from '@/lib/apiClient';

interface Profile {
    id: string;
    email: string;
    name: string;
    designation?: string;
    phone?: string;
    avatar_url?: string;
    role?: string;
    dob?: string;
}
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function TeamPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: employeesData, isLoading: loading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiGet('/api/profile?type=employees'),
  });

  const employees: Profile[] = (employeesData as any[]) || [];

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-up max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton width={40} height={40} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              <Skeleton width={200} height={32} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            </div>
            <Skeleton width={250} height={16} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          </div>
          <div className="w-full md:w-96">
            <Skeleton height={44} borderRadius={12} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 overflow-hidden">
              <div className="flex flex-col items-center text-center space-y-4">
                <Skeleton circle width={80} height={80} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                <div className="space-y-2 w-full flex flex-col items-center">
                  <Skeleton width={120} height={20} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                  <Skeleton width={100} height={24} borderRadius={12} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                </div>
                <div className="w-full pt-4 border-t border-border/50 space-y-3 flex flex-col items-center">
                  <Skeleton width={140} height={16} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                  <Skeleton width={120} height={16} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                  <Skeleton width={100} height={16} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                </div>
              </div>
            </div>
          ))}
        </div>
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
          <p className="text-muted-foreground text-sm">Meet the amazing people behind the work</p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search team members..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-input bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
          <div
            className="group relative bg-card hover:bg-primary/5 border border-border/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-500" />

            <div className="relative flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold text-xl shadow-inner overflow-hidden border-2 border-background">
                  {emp.avatar_url ? (
                    <img
                      src={emp.avatar_url}
                      alt={emp.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    emp.name.split(' ').map(n => n[0]).join('')
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-background shadow-sm border border-border flex items-center justify-center">
                  {emp.role === 'admin' ? <Shield className="w-3 h-3 text-primary" /> : <User className="w-3 h-3 text-primary" />}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{emp.name}</h3>
                <p className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 w-fit mx-auto uppercase tracking-wider">
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
          </div>
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
