import { Router } from "express";
import { AssistantSchema } from "@motatto/shared";
import { requirePermission, requireTenant, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { interpret } from "../services/assistant.js";
import { aiEnabled, transcribeAudio } from "../services/ai.js";
import { AppError } from "../lib/errors.js";
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
  wrap(async (req, res) => {
    if (!aiEnabled()) {
      res.status(501).json({
        error: { code: "NOT_CONFIGURED", message: "Transcripción en servidor no configurada; usa el dictado del navegador" },
      });
      return;
    }
    const file = req.file;
    if (!file) throw new AppError(400, "VALIDATION", "Falta el archivo de audio");
    const text = await transcribeAudio({ buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname });
    res.json({ text });
  }),
);
