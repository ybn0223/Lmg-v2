import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import session from "express-session";
import MongoStore from 'connect-mongo';
import { ObjectId } from "mongodb";
import { connect, minifigsCollection, setsCollection, userMinifigCollection, blacklistCollection } from "./database";
import authRoutes from './routes/auth';
import resetRoutes from './routes/resetPass';
import { ensureAuthenticated, ensureNotAuthenticated } from './middlewares/authMiddleware';
import { Minifig } from "./types/types";

// Configure environment variables
dotenv.config();

const app: Express = express();

// Session store configuration
const store = new MongoStore({
  mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/lego",
  collectionName: 'sessions'
});

store.on('error', function(error: any) {
  console.error(error);
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET ?? 'default_secret', // Use your own secret key
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Middleware setup
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set('views', path.join(__dirname, "views"));

// Routes
app.use(authRoutes);
app.use(resetRoutes);

// Route handlers
app.get("/", ensureNotAuthenticated, (req, res) => {
  let userExists = false;
  let wrongCredentials = false;
  let emailNotFound = false;
  res.render("index", { user: req.session.user, userExists, wrongCredentials, emailNotFound, wrongPassword: false });
});

app.get("/home", ensureAuthenticated, (req, res) => {
  res.render("home", { user: req.session.user, wrongPassword: false });
});

app.get("/summary", ensureAuthenticated, (req, res) => {
  res.render("summary", { user: req.session.user, wrongPassword: false  });
});

app.get("/sets", ensureAuthenticated, async (req, res) => {
  let setsShow = [];
  try {
    const minifigs = await setsCollection.aggregate([
      { $match: { set_img_url: { $exists: true }, name: { $exists: true }, set_num: { $exists: true } } },
      { $sample: { size: 10 } }
    ]).toArray();
    setsShow = minifigs;
  } catch (error) {
    console.error('Error fetching minifigs:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
  const user = req.session.user;
  res.render("sets", { setsShow, user, wrongPassword: false  });
});

app.get("/sort", ensureAuthenticated, async (req, res) => {
  let minifigsShow = [];
  try {
    const minifigs = await minifigsCollection.aggregate([
      { $match: { set_img_url: { $exists: true }, name: { $exists: true }, set_num: { $exists: true } } },
      { $sample: { size: 10 } }
    ]).toArray();
    minifigsShow = minifigs;
  } catch (error) {
    console.error('Error fetching minifigs:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
  const user = req.session.user;
  res.render("sort", { minifigsShow, user, wrongPassword: false });
});






//NIEUWE-WERKRUIMTE
app.get('/collection', ensureAuthenticated, async (req, res) => {
  // Controleer of req.session.user gedefinieerd is, anders geeft error bij code eronder
  if (!req.session.user) {
    return res.status(401).send('Unauthorized');
  }
  try {

    // Haal de gebruiker zijn minifig collecties op
    const userMinifigCollectionDocument = await userMinifigCollection.findOne({ userId: req.session.user._id });

    // Controleer of er minifigs zijn voor deze gebruiker
    if (!userMinifigCollectionDocument || !userMinifigCollectionDocument.minifigs) {
      return res.render('collection', { minifigsShow: [], user: req.session.user, wrongPassword: false });
    }

    // Haal de minifigId's uit de document
    const minifigIds = userMinifigCollectionDocument.minifigs.map((id: string) => new ObjectId(id));

    // Zoek de daadwerkelijke minifiguren op basis van de minifigIds
    const minifigs = await minifigsCollection.find({ _id: { $in: minifigIds } }).toArray();
    
    // Render de collection view en geef de minifigs en user door
    res.render('collection', { minifigsShow: minifigs, user: req.session.user, wrongPassword: false });
  } catch (err) {
    console.error('Error fetching minifigs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/collection/delete/:minifigId', ensureAuthenticated, async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Unauthorized');
  }

  const { minifigId } = req.params;

  if (!minifigId) {
    return res.status(400).json({ error: 'minifigId is required' });
  }

  try {
    const result = await userMinifigCollection.updateOne(
      { userId: { $eq: req.session.user._id } }, // Alternatieve benadering met $eq operator
      { $pull: { minifigs: minifigId } } // Verwijder de minifigId uit de array
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Minifig not found in collection' });
    }

    res.redirect('/collection'); // Omleiden naar de collectiepagina na verwijdering
  } catch (err) {
    console.error('Error deleting minifig:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post("/addToBlacklist", async (req, res) => {
  try {
    const { minifigId } = req.body;
    console.log('Blacklisted minifigId:', minifigId); // Voeg deze logging toe

    // Controleer of de minifiguur bestaat voordat je hem aan de blacklist toevoegt
    const minifig = await minifigsCollection.findOne({ _id: ObjectId.createFromHexString(minifigId) });
    if (!minifig) {
        return res.status(404).json({ error: "Minifig not found." });
    }
    const minifigImgUrl = minifig.set_img_url;

    // Voeg de minifiguur toe aan de blacklist, inclusief relevante informatie
    await blacklistCollection.insertOne({
        _id: minifig._id,
        name: minifig.name,
        minifig_img_url: minifigImgUrl,
        // Voeg andere relevante velden toe zoals num_parts, set_num, etc. indien nodig
    });

    // Stuur een succesrespons terug
    res.status(200).json({ message: "Minifig added to blacklist successfully." });
} catch (error) {
    console.error("Error adding minifig to blacklist:", error);
    res.status(500).json({ error: "Internal Server Error" });
}
});
app.get("/blacklist", ensureAuthenticated, async (req, res) => {
  try {
      // Haal de minifiguren op die op de blacklist staan
      const blacklistMinifigs = await blacklistCollection.find({}).toArray();

      // Render de blacklist.ejs template en geef de juiste data door
      res.render("blacklist", { blacklistMinifigs, user: req.session.user, wrongPassword: false });
  } catch (error) {
      console.error('Error fetching blacklist minifigs:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.delete("/removeFromBlacklist/:minifigId", async (req, res) => {
  const { minifigId } = req.params;

  try {
      const deletedMinifig = await blacklistCollection.findOneAndDelete({ _id: ObjectId.createFromHexString(minifigId) });

      if (!deletedMinifig) {
          return res.status(404).json({ error: "Minifig not found in blacklist." });
      }

      res.status(200).json({ message: "Minifig removed from blacklist successfully." });
  } catch (error) {
      console.error("Error removing minifig from blacklist:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/addToUserMinifigCollection", async (req, res) => {
  try {
      const { userId, minifigId } = req.body;

      // Controleer of userId en minifigId correct zijn ingevuld
      if (!userId || !minifigId) {
          return res.status(400).json({ error: "Invalid request body." });
      }
      console.log('Collected minifigId:', minifigId);

      // Voeg de minifig toe aan de gebruikerscollectie
      const result = await userMinifigCollection.updateOne(
          { userId },
          {
              $setOnInsert: { userId },
              $addToSet: { minifigs: minifigId }
          },
          { upsert: true }
      );

      if (result.modifiedCount === 0 && result.upsertedCount === 0) {
          throw new Error("Failed to add minifig to collection.");
      }

      // Stuur een succesrespons terug
      res.status(200).json({ message: "Minifig added to user collection successfully." });
  } catch (error) {
      console.error("Error adding minifig to user collection:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});








// Handle 404 - Page Not Found
app.use((req, res) => {
  let userExists = false;
  let wrongCredentials = false;
  res.render("404", { user: req.session.user, userExists, wrongCredentials, wrongPassword: false });
});
// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  await connect();
  console.log(`Server started on http://localhost:${PORT}`);
});