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
    <div className="max-w-md mx-auto bg-white shadow-md rounded-xl p-10 mt-[30px]">
      <div className="flex justify-center mb-3">
        <img 
          src="https://coatingpro360.com/wp-content/uploads/2026/01/CP-Square-button-1024-x-1024.png"
          alt="CoatingPro360"
          className="w-80 h-80"
        />
      </div>

      {(localError || error) && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
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

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 leading-relaxed">
          Built by a contractor for contractors.<br />
          Turn more leads you already have into paying customers.
        </p>
        <a
          href="https://coatingpro360.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-sm font-semibold text-red-600 hover:text-red-800"
        >
          Get yours at CoatingPro360.com →
        </a>
      </div>
    </div>
  );
}