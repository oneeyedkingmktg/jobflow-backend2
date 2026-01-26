import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Login({ onForgotPassword }) {
  const { login, error, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    const result = await login(email, password);

    if (!result.success) {
      setLocalError(result.error || "Login failed");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white shadow-md rounded-xl p-10 mt-[60px]">
      <div className="flex justify-center mb-6">
        <img 
          src="https://coatingpro360.com/wp-content/uploads/2026/01/CP-Square-button-1024-x-1024.png"
          alt="CoatingPro360"
          className="w-80 h-80"
        />
      </div>

      {(localError || error) && (
        <div className="bg-red-100 text-red-700 border border-red-300 p-3 rounded mb-4">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input
          type="email"
          className="w-full border p-3 rounded mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Password</label>
        <input
          type="password"
          className="w-full border p-3 rounded mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded"
        >
          {isLoading ? "Loading..." : "Login"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Forgot Password?
        </button>
      </div>
    </div>
  );
}