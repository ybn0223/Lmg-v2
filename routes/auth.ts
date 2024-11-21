import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { usersCollection, registerUser } from '../database';
import { ensureAuthenticated } from '../middlewares/authMiddleware';

declare module 'express-session' {
  export interface SessionData {
    user: { [key: string]: any };
  }
}

const router = Router();

router.post('/register', async (req, res) => {
  const { email, username, password, password2 } = req.body;

  let wrongCredentials: boolean = false;
  let userExists: boolean = true;

  if (password !== password2) {
    return res.status(400).send('Passwords do not match');
  }

  try {
    const result = await registerUser(email, username, password);
    if (result !== 'User registered successfully') {
      res.render("index", {
        wrongCredentials,
        user: false,
        userExists,
        emailNotFound: false,
        wrongPassword: false 
      });
      return;
    }

    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(400).send('User was not found');
    }

    req.session.user = user;
    return res.redirect('/');
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).send('Server error');
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const emailNotFound : boolean = false;
  try {
    const user = await usersCollection.findOne({ username });
    if (!user) {
      res.render("index", {
        wrongCredentials: true,
        user: false,
        userExists: false,
        emailNotFound,
        wrongPassword: false 
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.render("index", {
        wrongCredentials: true,
        user: false,
        userExists: false,
        emailNotFound,
        wrongPassword: false 
      });
      return;
    }

    req.session.user = user;
    return res.redirect('/');
  } catch (error) {
    console.error('Error logging in user:', error);
    return res.status(500).send('Server error');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Server error');
    }
    res.redirect('/');
  });
});

router.post('/change-password',ensureAuthenticated , async (req, res) => {
  try {
    const { currentPassword, newPassword, username } = req.body;

    const user = await usersCollection.findOne({ username: username });

    if (!user) {
      res.redirect('/404');
      return;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.render('home', { user: req.session.user, wrongPassword: true });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await usersCollection.updateOne(
      { username: username },
      { $set: { password: hashedPassword } }
    );

    return res.render('home', { user: req.session.user, wrongPassword: false });

  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;