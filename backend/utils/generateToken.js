import jwt from 'jsonwebtoken';

// Generate Access Token (short lived)
export const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

// Generate Refresh Token (long lived)
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

// Set tokens in HTTP-only cookies
export const sendTokenResponse = (user, statusCode, res, extra = {}) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  user.password = undefined;

  // NOTE: accessToken travels ONLY in the httpOnly cookie (never in JSON),
  // so XSS cannot steal it from localStorage / response bodies.
  res.status(statusCode).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      avatar: user.avatar || '',
      authProvider: user.authProvider || 'local',
    },
    ...extra,
  });
};
