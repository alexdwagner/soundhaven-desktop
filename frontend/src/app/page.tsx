"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("Waiting for Electron...");
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (window.electron) {
      setMessage(window.electron.test()); // Test Electron connection
  
      window.electron.getUsers().then((data: unknown) => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          console.error("Unexpected data format from getUsers:", data);
          setUsers([]); // Prevents crashing
        }
      });
  
      window.electron.send("ping", "Hello from Next.js!");
      window.electron.receive("pong", (data: string) => {
        setMessage(`Received from Electron: ${data}`);
      });
    } else {
      console.warn("Electron not detected in frontend.");
      setMessage("Electron not detected.");
    }
  }, []);
  

  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">{message}</h1>
      <h2 className="text-lg">Users List</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id} className="p-2 border">
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </main>
  );
}
