const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");
const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } = require("firebase/auth");

const app = express();
const port = 9100;

const firebaseConfig = {
  apiKey: "AIzaSyDzDndqZHyYRhrEaPECNnrvXIgfECbWWp4",
  authDomain: "story-14143.firebaseapp.com",
  projectId: "story-14143",
  storageBucket: "story-14143.firebasestorage.app",
  messagingSenderId: "709084970199",
  appId: "1:709084970199:web:b0bc39807b2c0fdecd4492",
  measurementId: "G-2SN44LGV3B"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// MongoDB setup
const mongoUri = "mongodb://localhost:27017/storiesDB";
let dbClient;

async function connectToDB() {
  dbClient = new MongoClient(mongoUri);
  try {
    await dbClient.connect();
    console.log("Connected to MongoDB");

    // Ensure likes field is an array for existing documents
    await updateLikesField();
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}
connectToDB();

// Ensure likes field is an array for existing documents
async function updateLikesField() {
  const storage = dbClient.db("storyDB").collection("stories");
  await storage.updateMany(
    { likes: { $exists: true, $not: { $type: "array" } } },
    { $set: { likes: [] } }
  );
  console.log("Updated likes field to be an array");
}

// Middleware: Check authentication
function isAuthenticated(req, res, next) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      req.user = user;
      next();
    } else {
      res.redirect("/login");
    }
  });
}

// Express app setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Middleware: Check authentication
function isAuthenticated(req, res, next) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      req.user = user;
      next();
    } else {
      res.redirect("/login");
    }
  });
}

// Routes
// Routes
app.get("/", async (req, res) => {
  const genre = req.query.genre || "All";
  try {
    const storage = dbClient.db("storyDB").collection("stories");
    let query = { public: true };
    if (genre !== "All") {
      query.genre = genre;
    }
    const stories = await storage.find(query).sort({ likes: -1 }).toArray();

    // Ensure likes is an array
    stories.forEach(story => {
      if (!Array.isArray(story.likes)) {
        story.likes = [];
      }
    });

    const userPhotoUrl = req.user ? req.user.photoURL : "https://img.freepik.com/premium-vector/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?w=360";

    res.render("story", { stories, currentUserId: req.user ? req.user.uid : null, pageTitle: "All Stories", userPhotoUrl });
  } catch (error) {
    console.log("Error fetching stories:", error);
    res.status(500).send("Error fetching stories");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { name, email, password, confirmPassword, photoUrl } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update the user's display name and photo URL in Firebase Authentication
    await updateProfile(user, { displayName: name, photoURL: photoUrl });

    console.log(`User ${name} signed up successfully`);
    res.redirect("/login");
  } catch (error) {
    console.error("Error signing up:", error.message);
    res.status(500).send(`Error signing up. Please try again. Error: ${error.message}`);
  }
});


app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    res.redirect("/");
  } catch (error) {
    console.error("Error logging in:", error.message);
    res.status(500).send("Error logging in. Please try again.");
  }
});

app.get("/logout", (req, res) => {
  auth.signOut()
    .then(() => {
      res.redirect("/login");
    })
    .catch((error) => {
      console.error("Error logging out:", error);
      res.status(500).send("Error logging out");
    });
});

app.get("/submit-story", isAuthenticated, (req, res) => {
  res.render("submitStory");
});

app.post("/submit-story", isAuthenticated, async (req, res) => {
  const { title, description, content, genre, visibility } = req.body;
  const userId = req.user.uid;

  try {
    const storage = dbClient.db("storyDB").collection("stories");
    await storage.insertOne({
      title,
      description,
      content,
      genre,
      userId,
      likes: [],
      public: visibility === "public",
      createdAt: new Date(),
      comments: [] // Initialize comments as an empty array
    });
    res.redirect("/");
  } catch (error) {
    console.log("Error submitting story:", error);
    if (!res.headersSent) {
      res.status(500).send("Error submitting story");
    }
  }
});

app.get("/profile", isAuthenticated, async (req, res) => {
  const userId = req.user.uid;

  try {
    const storage = dbClient.db("storyDB").collection("stories");

    const publicStories = await storage.find({ userId, public: true }).sort({ likes: -1 }).toArray();
    const privateStories = await storage.find({ userId, public: false }).sort({ likes: -1 }).toArray();

    res.render("profile", { publicStories, privateStories, userPhotoUrl: req.user.photoURL });
  } catch (error) {
    console.log("Error fetching stories:", error);
    if (!res.headersSent) {
      res.status(500).send("Error fetching stories");
    }
  }
});

// ...existing code...

app.get('/profile', (req, res) => {
  const user = auth.currentUser;
  if (user) {
    const userName = user.displayName || user.email; // Use displayName if available, otherwise use email
    res.render('profile', { userName, publicStories: [], privateStories: [] }); // Pass userName to the template
  } else {
    res.redirect('/login'); // Redirect to login if user is not authenticated
  }
});

// ...existing code...

app.get("/edit-story/:id", isAuthenticated, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user.uid;

  try {
    const storage = dbClient.db("storyDB").collection("stories");
    const story = await storage.findOne({ _id: new ObjectId(storyId), userId });

    if (!story) {
      return res.status(404).send("Story not found or you do not have permission to edit this story.");
    }

    res.render("editStory", { story });
  } catch (error) {
    console.log("Error fetching story for editing:", error);
    if (!res.headersSent) {
      res.status(500).send("Error fetching story for editing");
    }
  }
});

app.post("/edit-story/:id", isAuthenticated, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user.uid;
  const { title, description, content, genre, visibility } = req.body;

  try {
    const storage = dbClient.db("storyDB").collection("stories");
    const result = await storage.updateOne(
      { _id: new ObjectId(storyId), userId },
      {
        $set: {
          title,
          description,
          content,
          genre,
          public: visibility === "public",
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send("Story not found or you do not have permission to edit this story.");
    }

    res.redirect("/profile");
  } catch (error) {
    console.log("Error updating story:", error);
    if (!res.headersSent) {
      res.status(500).send("Error updating story");
    }
  }
});

app.post("/like/:id", isAuthenticated, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.user.uid;

  try {
    const storage = dbClient.db("storyDB").collection("stories");
    const story = await storage.findOne({ _id: new ObjectId(storyId) });

    if (!story) {
      return res.status(404).send("Story not found");
    }

    // Ensure likes is an array
    if (!Array.isArray(story.likes)) {
      story.likes = [];
    }

    const hasLiked = story.likes.includes(userId);

    if (hasLiked) {
      // Dislike the story
      await storage.updateOne(
        { _id: new ObjectId(storyId) },
        { $pull: { likes: userId } }
      );
    } else {
      // Like the story
      await storage.updateOne(
        { _id: new ObjectId(storyId) },
        { $addToSet: { likes: userId } }
      );
    }

    res.redirect("back");
  } catch (error) {
    console.log("Error liking/disliking story:", error);
    if (!res.headersSent) {
      res.status(500).send("Error liking/disliking story");
    }
  }
});

app.get('/story', (req, res) => {
  const userName = req.user ? req.user.displayName : null; // Assuming user object has displayName property
  res.render('story', { userName });
});

app.post("/story/:id/comment", isAuthenticated, async (req, res) => {
  const storyId = req.params.id;
  const { content } = req.body;
  const userId = req.user.uid;
  const author = req.user.displayName;

  try {
    const storage = dbClient.db("storyDB").collection("stories");
    const comment = {
      content,
      author,
      userId,
      createdAt: new Date()
    };

    await storage.updateOne(
      { _id: new ObjectId(storyId) },
      { $push: { comments: comment } }
    );

    res.redirect(`/story/${storyId}`);
  } catch (error) {
    console.log("Error posting comment:", error);
    if (!res.headersSent) {
      res.status(500).send("Error posting comment");
    }
  }
});

app.get("/story/:id", async (req, res) => {
  try {
    const storage = dbClient.db("storyDB").collection("stories");
    const story = await storage.findOne({ _id: new ObjectId(req.params.id) });

    if (!story) {
      return res.status(404).send("Story not found");
    }

    const comments = story.comments || [];

    res.render("story-detail", { story, comments });
  } catch (error) {
    console.log("Error fetching story:", error);
    if (!res.headersSent) {
      res.status(500).send("Error fetching story");
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});