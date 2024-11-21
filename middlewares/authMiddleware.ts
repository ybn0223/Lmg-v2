import { Request, Response, NextFunction } from 'express';

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/');
  }
}

function ensureNotAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    return res.redirect('/home'); // Redirect to home if already logged in
  }
  next();
}

export { ensureAuthenticated, ensureNotAuthenticated };