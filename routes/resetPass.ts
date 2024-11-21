import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { usersCollection } from '../database'; // Adjust import path as per your project structure
import dotenv from 'dotenv';
import bcrypt from "bcrypt";

const router = Router();
dotenv.config();

const resetMail : string = process.env.RESET_EMAIL ?? "";
const resetPass : string = process.env.RESET_PASS ?? "";

// POST route to handle forgot password request
router.post('/forgotPassword', async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email in MongoDB collection
        const user = await usersCollection.findOne({ email });
        if (!user) {
            let wrongCredentials : boolean = false;
            let userExists : boolean = false;
            let user : boolean = false;
            let emailNotFound : boolean = true;
            res.render("index", {
              wrongCredentials, user, userExists, emailNotFound, wrongPassword: false 
          })
          return;        }

        // Generate a unique token for password reset
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpiration = new Date(Date.now() + 3600000); // Token expires in 1 hour

        // Update user's resetToken and resetTokenExpiration in MongoDB collection
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $set: {
                    resetToken,
                    resetTokenExpiration
                }
            }
        );

        // Send password reset email (replace with your email sending logic)
        const transporter = nodemailer.createTransport({
            // Your email configuration
            service: 'gmail',
            auth: {
                user: resetMail,
                pass: resetPass
            }
        });

        const mailOptions = {
            from: resetMail,
            to: user.email,
            subject: 'LMG Project wachtwoord opnieuw instellen',
            text: `Je hebt aangegeven dat je het wachtwoord voor LMG project bent vergeten. Je kunt een nieuw wachtwoord instellen door op de onderstaande link te klikken\n\nhttp://${req.headers.host}/users/reset-password/${resetToken}\n\nHeb je niet zelf aangegeven dat je jouw wachtwoord wil wijzigen? Dan kun je deze e-mail negeren.`
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error('Error sending password reset email:', err);
                res.redirect("/404");
            }
            res.redirect("/");
        });

    } catch (err) {
        console.error('Error processing forgot password request:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get("/users/reset-password/:token", async (req, res) =>{
    const token = req.params.token;
    try {
        // Ensure token is a string
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Find user by reset token and check token expiration in MongoDB collection
        const user = await usersCollection.findOne({
            resetToken: token,
            resetTokenExpiration: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        // Render the password reset form
        let wrongCredentials : boolean = false;
        let userExists : boolean = false;
        let emailNotFound : boolean = false;
        res.render('resetPassword', { token, user : userExists, emailNotFound, wrongCredentials, userExists, wrongPassword: false  });
    } catch (err) {
        console.error('Error rendering password reset form:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST route to handle password reset with token
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // Find user by reset token and check token expiration in MongoDB collection
        const user = await usersCollection.findOne({
            resetToken: token,
            resetTokenExpiration: { $gt: new Date() }
        });

        if (!user) {
            res.redirect("/404");
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let date : Date = new Date("0001-01-01");
        // Update user's password (in a real application, you would hash the password before saving)
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: hashedPassword,
                    resetToken: "",
                    resetTokenExpiration: date
                },
            }
        );
        res.redirect("/");
        return;
    } catch (err) {
        console.error('Error resetting password:', err);
        res.redirect("/404")
        return;
    }
});

export default router;