'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { getProfile, updateProfile, deleteProfile, Profile, uploadAvatar } from '@/app/actions/profile';
import {
    User,
    Mail,
    Briefcase,
    Phone,
    Edit3,
    Save,
    X,
    Loader2,
    ChevronLeft,
    ShieldCheck,
    Palmtree,
    Trash2,
    Calendar,
    Upload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Mosaic } from 'react-loading-indicators';

export default function ProfilePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        designation: '',
        phone: '',
        total_leaves: 0,
        add_on_leaves: 0,
        dob: '',
    });

    useEffect(() => {
        async function loadProfile() {
            if (!id) return;
            setLoading(true);
            const data = await getProfile(id);
            if (data) {
                setProfile(data);
                setFormData({
                    name: data.name || '',
                    designation: data.designation || '',
                    phone: data.phone || '',
                    total_leaves: data.total_leaves ?? 20,
                    add_on_leaves: data.add_on_leaves ?? 0,
                    dob: data.dob || '',
                });
            }
            setLoading(false);
        }
        loadProfile();
    }, [id]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const submitData = { ...formData };
            if (!submitData.dob || submitData.dob.trim() === '') {
                (submitData as any).dob = null;
            }

            const result = await updateProfile(id, submitData);
            if (result.success) {
                toast.success(result.message || 'Profile updated');
                setIsEditing(false);
                setProfile(prev => prev ? { ...prev, ...formData } : null);
            } else {
                toast.error(result.error || 'Failed to update profile');
            }
        });
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        const result = await deleteProfile(id);

        if (result.success) {
            toast.success('Profile deleted successfully');
            router.push('/employees');
        } else {
            toast.error(result.error || 'Failed to delete profile');
            setIsDeleting(false);
        }
    };

    // handle user avatar upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile) return;

        if (file.size > 20 * 1024) {
            toast.error('Image size must be less than 20KB');
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await uploadAvatar(profile.id, formData);

            if (result.error) {
                toast.error(result.error);
                return;
            }

            setProfile(prev => prev ? { ...prev, avatar_url: result.url } : null);
            toast.success('Avatar updated!');

        } catch (err) {
            console.error(err);
            toast.error('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Mosaic color="#f88a10" size="small" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <p className="text-muted-foreground">Profile not found</p>
                <button onClick={() => router.back()} className="text-primary hover:underline flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Go Back
                </button>
            </div>
        );
    }

    const canEdit = currentUser?.role === 'admin' || currentUser?.id === profile.id;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
            {/* Header / Cover Area */}
            <div className="relative group">
                <div className="h-32 md:h-48 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-border/50 overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                </div>

                <div className="absolute -bottom-12 left-8 flex items-end gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-sidebar-background dark:bg-slate-300 border-4 border-background shadow-xl flex items-center justify-center text-4xl font-bold text-white dark:text-black relative overflow-hidden">
                            {profile.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.name}
                                    className={`w-full h-full object-cover rounded-xl ${isUploading ? 'opacity-50' : ''}`}
                                />
                            ) : (
                                <span className={isUploading ? 'opacity-50' : ''}>{profile.name?.charAt(0) || 'U'}</span>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="avatarUpload"
                            disabled={isUploading}
                        />

                        <label
                            htmlFor="avatarUpload"
                            className={`absolute bottom-2 right-2 p-1 border rounded-lg text-xs transition-colors ${isUploading ? 'bg-muted cursor-not-allowed text-muted-foreground' : 'bg-background hover:bg-gray-200 dark:hover:bg-[#080c17] cursor-pointer'}`}
                        >
                            {isUploading ? 'Uploading...' : <Upload className="w-4 h-4" />}
                        </label>
                    </div>

                    <div className="pb-2 hidden sm:block">
                        <h1 className="text-2xl font-bold">{profile.name}</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Briefcase className="w-4 h-4" /> {profile.designation || 'Position not set'}
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-4 right-4 flex gap-2">
                    {currentUser?.role === 'admin' && profile.id !== currentUser.id && !isEditing && (
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete Profile
                        </button>
                    )}
                    {canEdit && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="glass-button flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                        >
                            <Edit3 className="w-4 h-4" /> Edit Profile
                        </button>
                    )}
                    {isEditing && (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="bg-muted text-muted-foreground flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
                            >
                                <X className="w-4 h-4" /> Cancel
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={isPending}
                                className="bg-primary text-primary-foreground flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="pt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="stat-card">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Account Status</h3>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${profile.role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'}`}>
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-medium capitalize">{profile.role}</p>
                                <p className="text-xs text-muted-foreground">Access Level</p>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Leave Balance</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Palmtree className="w-4 h-4 text-warning" />
                                    <span className="text-sm">Remaining</span>
                                </div>
                                <span className="font-bold text-lg text-warning">{profile.remaining_leaves ?? 0}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-warning transition-all"
                                    style={{ width: `${((profile.remaining_leaves ?? 0) / (profile.total_leaves || 1)) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center">
                                Out of {profile.total_leaves ?? 0} annual leaves
                            </p>
                        </div>
                    </div>

                    {/* <div className="stat-card">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Documents</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileCheck className={`w-4 h-4 ${profile.document_submit ? 'text-success' : 'text-muted-foreground/30'}`} />
                                Submitted: {profile.document_submit ? 'Yes' : 'No'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileCheck className={`w-4 h-4 ${profile.document_received ? 'text-success' : 'text-muted-foreground/30'}`} />
                                Received: {profile.document_received ? 'Yes' : 'No'}
                            </div>
                        </div>
                    </div> */}
                </div>

                {/* Main Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="stat-card">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">Personal Information</h2>
                            {isEditing && <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Editing</span>}
                        </div>

                        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={(e) => e.preventDefault()}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <User className="w-3.5 h-3.5" /> Full Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    disabled={!isEditing}
                                    placeholder="Employee Name"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5" /> Work Email
                                </label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-muted-foreground italic"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Briefcase className="w-3.5 h-3.5" /> Designation
                                </label>
                                <input
                                    type="text"
                                    value={formData.designation}
                                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                    disabled={!isEditing}
                                    placeholder="e.g. Senior Developer"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5" /> Phone Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    disabled={!isEditing}
                                    placeholder="+91 98765 43210"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5" /> Date of Birth
                                </label>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={formData.dob}
                                        onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    />
                                ) : profile.dob ? (
                                    <div className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-foreground">
                                        {new Date(profile.dob).toLocaleDateString('en-GB', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="w-full bg-background border border-dashed border-border rounded-xl px-4 py-2.5 text-muted-foreground hover:bg-muted/50 hover:text-primary transition-all flex items-center gap-2 group"
                                    >
                                        <Edit3 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        Add Date of Birth
                                    </button>
                                )}
                            </div>

                            {currentUser?.role === 'admin' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Palmtree className="w-3.5 h-3.5" /> Total Leaves (Annual)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.total_leaves}
                                            onChange={e => setFormData({ ...formData, total_leaves: parseInt(e.target.value) || 0 })}
                                            disabled={!isEditing}
                                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Palmtree className="w-3.5 h-3.5" /> Add-on Leaves
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.add_on_leaves}
                                            onChange={e => setFormData({ ...formData, add_on_leaves: parseInt(e.target.value) || 0 })}
                                            disabled={!isEditing}
                                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                                        />
                                    </div>
                                </>
                            )}
                        </form>
                    </div>

                    {/* <div className="stat-card">
                        <h2 className="text-lg font-bold mb-4">Account Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Employee ID</p>
                                <p className="font-mono text-sm bg-muted px-2 py-1 rounded w-fit">{profile.emp_id || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Joined On</p>
                                <p className="text-sm">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                    </div> */}
                </div>
            </div>
        </div>
    );
}

