import { Users, Mail, Shield } from 'lucide-react';
import { Badge } from '../components/ui/badge';

const employees = [
  { name: 'Rahul Sharma', email: 'rahul@company.com', department: 'Engineering', role: 'emp', status: 'present' },
  { name: 'Priya Patel', email: 'priya@company.com', department: 'Operations', role: 'admin', status: 'present' },
  { name: 'Ankit Verma', email: 'ankit@company.com', department: 'Human Resources', role: 'hr', status: 'wfh' },
  { name: 'Sneha Gupta', email: 'sneha@company.com', department: 'Design', role: 'emp', status: 'leave' },
  { name: 'Vikram Singh', email: 'vikram@company.com', department: 'Engineering', role: 'emp', status: 'present' },
  { name: 'Neha Reddy', email: 'neha@company.com', department: 'Marketing', role: 'emp', status: 'absent' },
];

const statusColors: Record<string, string> = {
  present: 'bg-success/10 text-success',
  absent: 'bg-destructive/10 text-destructive',
  wfh: 'bg-info/10 text-info',
  leave: 'bg-warning/10 text-warning',
};

const roleColors: Record<string, string> = {
  admin: 'bg-accent/10 text-accent',
  hr: 'bg-primary/10 text-primary',
  emp: 'bg-secondary text-secondary-foreground',
};

export default function EmployeesPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-muted-foreground text-sm mt-1">Team overview and status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp, i) => (
          <div key={i} className="stat-card space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {emp.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{emp.name}</p>
                <p className="text-xs text-muted-foreground">{emp.department}</p>
              </div>
              <span className={`badge-status capitalize ${statusColors[emp.status]}`}>
                {emp.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" />
              {emp.email}
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <span className={`badge-status capitalize ${roleColors[emp.role]}`}>{emp.role}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
