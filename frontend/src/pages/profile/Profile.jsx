import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuCamera } from 'react-icons/lu';
import api, { fileUrl, showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import DetailGrid from '../../components/common/DetailGrid';
import { initials } from '../../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });

  const saveProfile = async (photo) => {
    try {
      const fd = new FormData();
      fd.append('full_name', form.full_name);
      fd.append('phone', form.phone);
      if (photo) fd.append('photo', photo);
      const { data } = await api.put('/auth/profile', fd);
      setUser(data);
      toast.success('Profile updated');
    } catch (e) {
      showError(e);
    }
  };
  const changePw = async () => {
    if (pw.new_password !== pw.confirm) return toast.error('Passwords do not match');
    try {
      await api.put('/auth/change-password', pw);
      toast.success('Password changed');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      showError(e);
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="card p-6 text-center">
        <div className="relative mx-auto h-24 w-24">
          {user.photo ? (
            <img src={fileUrl(user.photo)} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-2xl font-semibold text-white">{initials(user.full_name)}</span>
          )}
          <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-sidebar text-white">
            <LuCamera size={14} />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && saveProfile(e.target.files[0])} />
          </label>
        </div>
        <div className="mt-3 text-lg font-semibold">{user.full_name}</div>
        <div className="text-sm text-slate-500">{user.role_name || 'Administrator'}</div>
        <div className="mt-4 text-left">
          <DetailGrid cols={2} items={[{ label: 'Employee ID', value: user.employee_code }, { label: 'Department', value: user.department_name }, { label: 'Email', value: user.email, full: true }, { label: 'Data Visibility', value: user.is_super_admin ? 'All (super admin)' : user.data_scope }]} />
        </div>
      </div>
      <div className="card p-6">
        <h3 className="card-title mb-4">Edit Profile</h3>
        <label className="label">Full Name</label>
        <input className="input mb-3" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <label className="label">Phone</label>
        <input className="input mb-4" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button className="btn-primary" onClick={() => saveProfile(null)}>Save</button>
      </div>
      <div className="card p-6">
        <h3 className="card-title mb-4">Change Password</h3>
        <label className="label">Current Password</label>
        <input type="password" className="input mb-3" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
        <label className="label">New Password</label>
        <input type="password" className="input mb-3" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
        <label className="label">Confirm New Password</label>
        <input type="password" className="input mb-4" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        <button className="btn-primary" onClick={changePw}>Update Password</button>
      </div>
    </div>
  );
}
