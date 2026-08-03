import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuthStore } from "../store/authStore";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        {
          email,
          password,
        },
      );

      setAuth(response.data.user, response.data.token);
      navigate("/dashboard");
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : "Something went wrong";
      setError(message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-mono text-accent text-sm tracking-widest uppercase">
            CodeMind
          </span>
          <h1 className="font-mono text-2xl font-semibold mt-2">
            Welcome back
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-ink-raised border border-border rounded-lg p-6"
        >
          {error && (
            <div className="bg-danger-dim border border-danger/30 text-danger text-sm px-3 py-2 rounded mb-4 font-mono">
              {error}
            </div>
          )}

          <label className="block text-xs font-mono text-text-muted mb-1 uppercase tracking-wide">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-ink border border-border rounded px-3 py-2 mb-4 text-text focus:outline-none focus:border-accent transition-colors"
            required
          />

          <label className="block text-xs font-mono text-text-muted mb-1 uppercase tracking-wide">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-ink border border-border rounded px-3 py-2 mb-6 text-text focus:outline-none focus:border-accent transition-colors"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-ink font-mono font-semibold py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-sm text-center mt-5 text-text-muted">
            Don't have an account?{" "}
            <Link to="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
