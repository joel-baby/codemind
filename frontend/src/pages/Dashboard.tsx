import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useRepositoryStore } from "../store/repositoryStore";
import { useThemeStore } from "../store/themeStore";

function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isLight = useThemeStore((state) => state.isLight);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const repositories = useRepositoryStore((state) => state.repositories);
  const setRepositories = useRepositoryStore((state) => state.setRepositories);

  const [githubUrl, setGithubUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchRepositories = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/repositories`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRepositories(response.data.repositories);
    } catch (err) {
      console.error("Failed to fetch repositories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
    const interval = setInterval(fetchRepositories, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/repositories`,
        { githubUrl },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGithubUrl("");
      fetchRepositories();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : "Something went wrong";
      setError(message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, repoId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this repository and all its chat history?")) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/repositories/${repoId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      fetchRepositories();
    } catch (err) {
      console.error("Failed to delete repository", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleUpgrade = async () => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/upgrade`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAuth(response.data.user, token!);
    } catch (err) {
      console.error("Failed to switch plan", err);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-gray-200 text-gray-700",
    processing: "bg-yellow-100 text-yellow-700",
    ready: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-ink px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-start mb-10">
          <div>
            <span className="font-mono text-accent text-xs tracking-widest uppercase">
              CodeMind
            </span>
            <h1 className="font-mono text-2xl font-semibold mt-1">
              {user?.name}
            </h1>
            <span
              className={`inline-block mt-2 text-xs font-mono px-2 py-0.5 rounded ${
                user?.plan === "pro"
                  ? "bg-accent-dim text-accent"
                  : "bg-ink-raised text-text-muted border border-border"
              }`}
            >
              {user?.plan === "pro" ? "PRO" : "FREE"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="font-mono text-xs border border-border text-text-muted px-3 py-2 rounded hover:border-accent hover:text-accent transition-colors"
            >
              {isLight ? "Dark" : "Light"}
            </button>
            <button
              onClick={handleUpgrade}
              className="font-mono text-xs border border-border text-text-muted px-3 py-2 rounded hover:border-accent hover:text-accent transition-colors"
            >
              {user?.plan === "pro" ? "Switch to free" : "Upgrade (demo)"}
            </button>
            <button
              onClick={handleLogout}
              className="font-mono text-xs border border-border text-text-muted px-3 py-2 rounded hover:border-danger hover:text-danger transition-colors"
            >
              Log out
            </button>
          </div>
        </div>

        <form onSubmit={handleAddRepo} className="mb-8 flex gap-2">
          <input
            type="text"
            placeholder="https://github.com/owner/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            className="flex-1 bg-ink-raised border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent text-ink font-mono text-sm font-semibold px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Adding..." : "Add repo"}
          </button>
        </form>

        {error && (
          <div className="bg-danger-dim border border-danger/30 text-danger text-sm px-3 py-2 rounded mb-4 font-mono">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {loading && (
            <p className="text-text-muted font-mono text-sm">Loading...</p>
          )}

          {!loading && repositories.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-text-muted font-mono text-sm">
                No repositories yet. Add one above to get started.
              </p>
            </div>
          )}

          {repositories.map((repo) => {
            const statusStyles: Record<string, string> = {
              pending: "text-text-muted border-border",
              processing: "text-amber border-amber/30",
              ready: "text-signal border-signal/30",
              failed: "text-danger border-danger/30",
            };

            return (
              <div
                key={repo._id}
                onClick={() =>
                  repo.status === "ready" && navigate(`/chat/${repo._id}`)
                }
                className={`group relative bg-ink-raised border border-border rounded-lg pl-4 pr-4 py-3 ${
                  repo.status === "ready"
                    ? "cursor-pointer hover:border-accent/50"
                    : "cursor-default"
                } transition-colors`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-border group-hover:bg-accent transition-colors" />

                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-mono text-sm font-medium">
                      {repo.owner}/{repo.name}
                    </p>
                    <p className="text-xs text-text-muted font-mono mt-0.5">
                      {repo.fileCount} files
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border ${statusStyles[repo.status]}`}
                    >
                      {repo.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, repo._id)}
                      className="text-text-muted hover:text-danger transition-colors text-sm"
                      title="Delete repository"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {repo.status === "failed" && repo.errorMessage && (
                  <p className="text-xs text-danger font-mono mt-2">
                    {repo.errorMessage}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
