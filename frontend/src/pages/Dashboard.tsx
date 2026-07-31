import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useRepositoryStore } from "../store/repositoryStore";

function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const repositories = useRepositoryStore((state) => state.repositories);
  const setRepositories = useRepositoryStore((state) => state.setRepositories);

  const [githubUrl, setGithubUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchRepositories = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/repositories",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRepositories(response.data.repositories);
    } catch (err) {
      console.error("Failed to fetch repositories", err);
    }
  };

  useEffect(() => {
    fetchRepositories();
    const interval = setInterval(fetchRepositories, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await axios.post(
        "http://localhost:5000/api/repositories",
        { githubUrl },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGithubUrl("");
      fetchRepositories();
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, repoId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this repository and all its chat history?")) return;

    try {
      await axios.delete(`http://localhost:5000/api/repositories/${repoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRepositories();
    } catch (err) {
      console.error("Failed to delete repository", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const statusColors: Record<string, string> = {
    pending: "bg-gray-200 text-gray-700",
    processing: "bg-yellow-100 text-yellow-700",
    ready: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Log Out
        </button>
      </div>

      <form onSubmit={handleAddRepo} className="mb-8 flex gap-2">
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          className="flex-1 border p-2 rounded"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add Repo"}
        </button>
      </form>

      {error && (
        <p className="bg-red-100 text-red-600 text-sm p-2 rounded mb-4">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {repositories.length === 0 && (
          <p className="text-gray-500">
            No repositories yet. Add one above to get started.
          </p>
        )}

        {repositories.map((repo) => (
          <div
            key={repo._id}
            onClick={() =>
              repo.status === "ready" && navigate(`/chat/${repo._id}`)
            }
            className={`border rounded p-4 ${
              repo.status === "ready"
                ? "cursor-pointer hover:bg-gray-50"
                : "cursor-default"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {repo.owner}/{repo.name}
                </p>
                <p className="text-sm text-gray-500">{repo.fileCount} files</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${statusColors[repo.status]}`}
                >
                  {repo.status}
                </span>
                <button
                  onClick={(e) => handleDelete(e, repo._id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                  title="Delete repository"
                >
                  🗑️
                </button>
              </div>
            </div>

            {repo.status === "failed" && repo.errorMessage && (
              <p className="text-xs text-red-600 mt-2">
                Error: {repo.errorMessage}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
