import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="login-page-bg relative flex min-h-full min-w-0 flex-col items-center justify-center px-4 py-16">
      <img src="/logo.png" alt="3point0 Labs" className="mb-6 h-16 w-auto" />
      <LoginForm />
    </div>
  );
}
