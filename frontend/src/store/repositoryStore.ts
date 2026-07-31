import { create } from "zustand";

interface Repository {
  _id: string;
  githubUrl: string;
  owner: string;
  name: string;
  status: "pending" | "processing" | "ready" | "failed";
  fileCount: number;
  errorMessage?: string;
}

interface RepositoryState {
  repositories: Repository[];
  setRepositories: (repos: Repository[]) => void;
}

export const useRepositoryStore = create<RepositoryState>((set) => ({
  repositories: [],
  setRepositories: (repos) => set({ repositories: repos }),
}));