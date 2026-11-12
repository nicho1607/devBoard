import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "./http";

/**
 * Usuario de la BD para la sesión actual de Clerk. En el primer login lo crea
 * (o lo enlaza por email si fue invitado/sembrado antes de registrarse).
 * En producción conviene complementar con el webhook `user.updated` de Clerk.
 */
export const getCurrentUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;
  const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress;
  if (!email) throw new HttpError(400, "La cuenta no tiene un email verificado");

  const github = cu.externalAccounts.find((a) => a.provider === "oauth_github");
  const data = {
    clerkId: userId,
    name: cu.fullName ?? cu.username ?? email.split("@")[0],
    avatarUrl: cu.imageUrl,
    githubLogin: github?.username ?? null,
  };
  return prisma.user.upsert({ where: { email }, update: data, create: { ...data, email } });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "No autenticado");
  return user;
}

/**
 * Autorización a nivel proyecto: el usuario debe ser miembro del workspace.
 * Devolvemos 404 (no 403) a no-miembros para no revelar que el recurso existe.
 */
export async function requireProjectAccess(projectId: string, minRole: Role = "MEMBER") {
  const user = await requireUser();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, workspaceId: true },
  });
  if (!project) throw new HttpError(404, "Proyecto no encontrado");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: project.workspaceId } },
  });
  if (!membership) throw new HttpError(404, "Proyecto no encontrado");
  if (minRole === "ADMIN" && membership.role !== "ADMIN") {
    throw new HttpError(403, "Requiere rol de administrador");
  }
  return { user, project, membership };
}

export async function requireTaskAccess(taskId: string, minRole: Role = "MEMBER") {
  await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, creatorId: true },
  });
  if (!task) throw new HttpError(404, "Tarea no encontrada");
  return { ...(await requireProjectAccess(task.projectId, minRole)), task };
}
