import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiErrors';

type StatusState = {
  message: string;
  tone: 'success' | 'error';
};

export default function SuperuserTestEmailForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);

  const sendTestEmail = useMutation({
    mutationFn: async (to: string) => {
      const response = await api.post('/email/test', { to });
      return response.data;
    },
    onSuccess: () => {
      setStatus({ message: 'Test email sent.', tone: 'success' });
      setEmail('');
    },
    onError: (error: unknown) => {
      setStatus({
        message: getApiErrorMessage(error) ?? 'Failed to send test email.',
        tone: 'error',
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus(null);
    sendTestEmail.mutate(trimmed);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Recipient Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="w-full px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
          />
        </div>
        <button
          type="submit"
          disabled={sendTestEmail.isPending || !email.trim()}
          className="w-full px-4 py-2.5 min-h-[44px] bg-slate-800 text-white rounded hover:bg-slate-700 active:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
        >
          {sendTestEmail.isPending ? 'Sending Test Email...' : 'Send Test Email'}
        </button>
      </form>
      {status && (
        <p
          className={`text-sm ${
            status.tone === 'error' ? 'text-red-600' : 'text-green-700'
          }`}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
