import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuMail, LuLock, LuEye, LuEyeOff } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { errMsg } from '../../api/axios';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.full_name.split(' ')[0]}`);
      const to = (location.state && location.state.from && location.state.from.pathname) || '/dashboard';
      navigate(to, { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div className="text-[26px] font-bold tracking-wide">BIGBEE</div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">
            One source of truth for every <span className="text-brand">event</span>, from lead to closure.
          </h2>
          <p className="mt-4 text-slate-300">
            CRM, proposals, projects, vendors, finance and MIS for Bigbee Experience Management in a single connected platform.
          </p>
        </div>
        <div className="text-xs text-slate-500">© {new Date().getFullYear()} Bigbee Experience Management Pvt. Ltd.</div>
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
      </div>

      <div className="flex flex-1 items-center justify-center bg-page p-6">
        <form onSubmit={submit} className="card w-full max-w-md p-8">
          <div className="mb-1 text-[22px] font-bold text-ink lg:hidden">BIGBEE</div>
          <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Use your Bigbee CRM account to continue.</p>

          {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <label className="label">Email</label>
          <div className="relative mb-4">
            <LuMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-9" placeholder="you@company.com" autoFocus />
          </div>

          <label className="label">Password</label>
          <div className="relative mb-6">
            <LuLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="input px-9" placeholder="••••••••" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Toggle password">
              {show ? <LuEyeOff size={16} /> : <LuEye size={16} />}
            </button>
          </div>

          <button type="submit" className="btn-primary w-full !py-2.5" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
