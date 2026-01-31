import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from cookie via backend endpoint
        const response = await api.get('/auth/oauth/token', {
          withCredentials: true, // Include cookies
        });
        const { token } = response.data;

        // Fetch user info
        const userResponse = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Update auth context
        setAuth(token, userResponse.data.user);

        // Redirect to dashboard
        navigate('/');
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing sign in...</h2>
        <p className="mt-2 text-gray-600">Please wait while we finish setting up your account.</p>
      </div>
    </div>
  );
}
