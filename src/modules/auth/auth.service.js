const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { prisma } = require('../../prisma/client');
const { env } = require('../../config/env');
const { UnauthorizedError } = require('../../common/errors/app-error');

const REFRESH_TOKEN_HASH_ALGO = 'sha256';

function hashToken(token) {
  return crypto.createHash(REFRESH_TOKEN_HASH_ALGO).update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, areaId: user.areaId }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
}

async function issueRefreshToken(userId) {
  const tokenId = uuid();
  const raw = jwt.sign({ sub: userId, tokenId }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });
  const decoded = jwt.decode(raw);

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(decoded.exp * 1000),
    },
  });

  return raw;
}

const authService = {
  async login({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, areaId: user.areaId },
    };
  },

  async refresh(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });
    if (!stored || stored.revoked || stored.userId !== payload.sub || stored.tokenHash !== hashToken(refreshToken)) {
      throw new UnauthorizedError('Refresh token has been revoked or is invalid');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Account is no longer active');
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const accessToken = signAccessToken(user);
    const newRefreshToken = await issueRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  },


  async logout(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
      await prisma.refreshToken.updateMany({
        where: { id: payload.tokenId },
        data: { revoked: true },
      });
    } catch {
      
    }
  },
};

module.exports = { authService };
