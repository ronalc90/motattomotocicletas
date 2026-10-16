import { Router } from "express";
import { AssistantSchema } from "@motatto/shared";
import { requirePermission, requireTenant, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { interpret } from "../services/assistant.js";
import { audioUpload } from "../services/storage.js";

export const assistantRouter = Router();
assistantRouter.use(requireTenant, requirePermission("assistant:use"));

assistantRouter.post(
  "/",
  wrap(async (req, res) => {
    const input = parseBody(AssistantSchema, req);
    res.json(await interpret(req.tenantId!, input.text, input.context));
  }),
);

assistantRouter.post(
  "/transcribe",
  audioUpload.single("audio"),
  wrap(async (_req, res) => {
    res.status(501).json({
      error: { code: "NOT_CONFIGURED", message: "Transcripción en servidor no configurada; usa el dictado del navegador" },
    });
  }),
);
