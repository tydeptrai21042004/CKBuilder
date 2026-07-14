export class AppError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function formatError(error) {
  if (error instanceof AppError) {
    const suffix = error.details ? `\nDetails: ${JSON.stringify(error.details, null, 2)}` : "";
    return `[${error.code}] ${error.message}${suffix}`;
  }
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
