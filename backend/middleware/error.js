/* eslint-disable no-unused-vars */
function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'File is too large (max 10 MB)';
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'A record with the same unique value already exists';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    status = 409;
    message = 'This record is in use and cannot be deleted';
  } else if (err.code && String(err.code).startsWith('ER_')) {
    status = 400;
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
