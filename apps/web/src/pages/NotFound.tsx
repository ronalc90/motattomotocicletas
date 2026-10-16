import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { Logo } from "@/components/layout/Logo";

export function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="font-display text-5xl font-extrabold">404</h1>
      <p className="muted">Esta página no existe o se movió.</p>
      <Link to="/"><Button variant="dark">Ir al inicio</Button></Link>
    </div>
  );
}
