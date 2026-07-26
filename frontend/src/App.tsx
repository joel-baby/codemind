import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/hello")
      .then((response) => {
        setMessage(response.data.message);
      })
      .catch(() => {
        setMessage("Failed to reach backend.");
      });
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold text-blue-600">{message}</h1>
    </div>
  );
}

export default App;