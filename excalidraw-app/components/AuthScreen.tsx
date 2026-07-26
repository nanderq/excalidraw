import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { authClient } from "../auth-client";
import { loadExcalifont } from "../excalifont";

import "./AuthScreen.scss";

loadExcalifont();

const discordIcon = (
  <svg
    viewBox="0 0 256 199"
    width="18"
    height="18"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid"
  >
    <path
      d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z"
      fill="currentColor"
    />
  </svg>
);

export const AuthScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // where RequireAuth bounced us from, e.g. a share link followed without a
  // session. Only same-site paths, so the param can't be used as an open
  // redirect to somewhere off the app.
  const redirect = searchParams.get("redirect");
  const destination =
    redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: authError } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message ?? "Something went wrong");
      return;
    }

    navigate(destination);
  };

  const handleDiscordSignIn = async () => {
    setError(null);
    const { error: authError } = await authClient.signIn.social({
      provider: "discord",
      callbackURL: destination,
    });
    if (authError) {
      setError(authError.message ?? "Something went wrong");
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-screen__card">
        <h1>{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
        <button
          type="button"
          className="auth-screen__discord"
          onClick={handleDiscordSignIn}
        >
          {discordIcon}
          Continue with Discord
        </button>
        <div className="auth-screen__divider">or</div>
        <form onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <label>
              Name
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="auth-screen__error">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {mode === "sign-in" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <div className="auth-screen__switch">
          {mode === "sign-in" ? (
            <>
              No account yet?{" "}
              <button type="button" onClick={() => setMode("sign-up")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("sign-in")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
