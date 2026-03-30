"use client";

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Shield, Loader2, User, Trash, Search, X } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/apiClient';
import Link from 'next/link';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Profile {
  id: string;
  email: string;
  name: string;
  designation?: string;
  avatar_url?: string;
  role?: string;
  emp_id?: string;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: employeesData, isLoading: loading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiGet('/api/profile?type=employees'),
  });

  // 1. Memoized Employee data derivation
  const employees: Profile[] = useMemo(() => Array.isArray(employeesData) ? (employeesData as any[]) : [], [employeesData]);

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    const res = await apiDelete(`/api/profile?id=${confirmDeleteId}`);
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
    setDeleting(false);
    setConfirmDeleteId(null);
  };

  // 2. Memoized Search filtering
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(emp =>
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.emp_id?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // 3. Progressive Loading Strategy: Render Header and SearchBar immediately
  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-muted-foreground text-sm mt-1">Team overview and status</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by employee name, email, ID or designation…"
          className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
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

      {/* Grid of employees or Skeletal Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stat-card space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton circle width={40} height={40} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                <div className="flex-1">
                  <Skeleton width="60%" height={14} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                  <Skeleton width="40%" height={12} style={{ marginTop: 4 }} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                </div>
              </div>
              <Skeleton width="75%" height={12} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <Skeleton width={50} height={12} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                <Skeleton width={60} height={16} borderRadius={4} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              </div>
            </div>
          ))
        ) : filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => (
            <Link
              key={emp.id}
              href={`/profile/${emp.id}`}
              className="stat-card space-y-3 block hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors overflow-hidden">
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      emp.name.split(' ').map(n => n[0]).join('')
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.designation || 'Employee'}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setConfirmDeleteId(emp.id);
                  }}
                  className="p-1 rounded hover:bg-red-500/10 transition-colors"
                >
                  <Trash className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{emp.email}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{emp.role}</span>
                </div>
                {emp.emp_id && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {emp.emp_id}
                  </span>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? `No employees match "${searchQuery}".` : 'No employees found.'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Delete Employee</h2>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this employee? All associated data will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
