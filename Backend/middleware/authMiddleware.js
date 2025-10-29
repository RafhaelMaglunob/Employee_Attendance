// middleware/authMiddleware.js
export async function authMiddleware(req, reply) {
  try {
    await req.jwtVerify();

  } catch (err) {
    console.error("JWT Error:", err);
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
}
