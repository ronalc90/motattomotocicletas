export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Recurso"): AppError => new AppError(404, "NOT_FOUND", `${what} no encontrado`);
export const forbidden = (message = "No tienes permiso para esta acción"): AppError =>
  new AppError(403, "FORBIDDEN", message);
export const badRequest = (message: string, code = "BAD_REQUEST", details?: unknown): AppError =>
  new AppError(400, code, message, details);
export const conflict = (message: string, code = "CONFLICT"): AppError => new AppError(409, code, message);
