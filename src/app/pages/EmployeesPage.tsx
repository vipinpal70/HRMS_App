"use client";

import { useEffect, useState } from 'react';
import { Mail, Shield, Loader2, User } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { getEmployees, Profile } from '@/app/actions/profile';
import Link from 'next/link';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-muted-foreground text-sm mt-1">Team overview and status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <Link
            key={emp.id}
            href={`/profile/${emp.id}`}
            className="stat-card space-y-3 block hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors overflow-hidden">
                {emp.avatar ? (
                  <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                ) : (
                  emp.name.split(' ').map(n => n[0]).join('')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{emp.name}</p>
                <p className="text-xs text-muted-foreground">{emp.designation || 'Employee'}</p>
              </div>
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
        ))}
      </div>

      {employees.length === 0 && (
        <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
          <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No employees found.</p>
        </div>
      )}
    </div>
  );
}
