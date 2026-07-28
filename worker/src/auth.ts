export function deviceTokenFromRequest(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || undefined;
}
