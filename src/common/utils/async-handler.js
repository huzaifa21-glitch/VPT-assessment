// Wraps an async route handler so rejected promises reach the error
// middleware instead of crashing the process / hanging the request.
// Every controller in this app uses this — avoids a try/catch per handler.
// Returns the underlying promise — Express itself ignores middleware return
// values either way, but this lets tests `await` a wrapped handler and then
// assert on what `next` was called with.
const asyncHandler = (handler) => (req, res, next) => handler(req, res, next).catch(next);

module.exports = { asyncHandler };
