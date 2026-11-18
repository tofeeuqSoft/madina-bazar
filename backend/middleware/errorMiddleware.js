const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  // Honor explicit status from services/controllers (err.statusCode / err.status)
  let statusCode = err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode);

  // Mongoose / Mongo error mapping — never leak stacks, always meaningful codes
  let code = err.code;
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = code || 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
  }

  if (statusCode >= 500) {
    import('../utils/logger.js').then((m) => m.default.error(`${req.method} ${req.originalUrl} — ${err.message}`, { stack: err.stack })).catch(() => {});
  }

  const body = {
    success: false,
    message: err.message || 'Server error',
  };
  if (code) body.code = code;
  // Stack traces only in development — never in production responses
  if (process.env.NODE_ENV !== 'production' && err.stack) body.stack = err.stack;

  res.status(statusCode).json(body);
};

export { notFound, errorHandler };
