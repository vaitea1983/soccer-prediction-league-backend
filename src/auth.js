import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";

export function createToken(account) {
  return jwt.sign(
    { sub: account.id, playerName: account.player_name || account.playerName },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Authentication required." });

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function requireSelf(req, res, next) {
  if (req.auth?.sub !== req.params.accountId) {
    return res.status(403).json({ error: "This private profile is only visible to the signed-in player." });
  }
  next();
}
