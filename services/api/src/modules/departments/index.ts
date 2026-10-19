import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { sendSuccess } from "../../lib/response.js";

export const departmentsRouter = Router();

departmentsRouter.get("/", async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { code: "asc" },
    });
    sendSuccess(res, departments, 200);
  } catch (err) {
    next(err);
  }
});
