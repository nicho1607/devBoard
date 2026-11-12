import "server-only";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Envuelve un route handler: traduce HttpError/ZodError a respuestas JSON. */
export function route<Ctx>(handler: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return Response.json({ error: "Datos inválidos", issues: err.flatten() }, { status: 422 });
      }
      console.error(err);
      return Response.json({ error: "Error interno" }, { status: 500 });
    }
  };
}
