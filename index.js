const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3g5ecwq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://find-lost-app-38c76.web.app'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

const logger = (req, res, next) => {
  console.log('inside the logger middleware');
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) return res.status(401).send({ message: 'unauthorized access' });

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'unauthorized access' });
    req.decoded = decoded;
    next();
  });
};

// Start server after connecting to MongoDB
async function run() {
  try {
    await client.connect();
    const db = client.db("findLost");
    const itemsCollection = db.collection("items");
    const recoveriesCollection = db.collection("recoveries");

    // JWT token
    app.post('/jwt', (req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "none"
      });

      res.send({ success: true });
    });

    // Items
    app.get("/items", async (req, res) => {
      const query = req.query.email ? { email: req.query.email } : {};
      const items = await itemsCollection.find(query).toArray();
      res.send(items);
    });

    app.get("/items/recoveries", async (req, res) => {
      const query = req.query.email ? { email: req.query.email } : {};
      const items = await itemsCollection.find(query).toArray();

      for (const item of items) {
        item.recovery_count = await recoveriesCollection.countDocuments({ itemId: item._id.toString() });
      }

      res.send(items);
    });

    app.get("/items/:id", async (req, res) => {
      const item = await itemsCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(item);
    });

    app.post("/items", async (req, res) => {
      const result = await itemsCollection.insertOne(req.body);
      res.send(result);
    });

    // Recoveries
    app.get("/recoveries", logger, verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) return res.status(403).send({ message: 'forbidden access' });

      const result = await recoveriesCollection.find({ "recoveredBy.email": email }).toArray();

      for (const recovery of result) {
        const item = await itemsCollection.findOne(
          { _id: new ObjectId(recovery.itemId) },
          { projection: { name: 1, category: 1, image: 1, status: 1 } }
        );
        if (item) {
          recovery.itemName = item.name;
          recovery.itemCategory = item.category;
          recovery.itemImage = item.image;
          recovery.itemStatus = item.status;
        }
      }

      res.send(result);
    });

    app.get("/recoveries/item/:item_id", async (req, res) => {
      const result = await recoveriesCollection.find({ itemId: req.params.item_id }).toArray();
      res.send(result);
    });

    app.post("/recoveries", async (req, res) => {
      if (!req.body.itemId) return res.status(400).send({ message: "Missing itemId" });
      const result = await recoveriesCollection.insertOne(req.body);
      res.send(result);
    });

    app.patch("/recoveries/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updateDoc = { $set: { status: req.body.status } };
      const result = await recoveriesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("Lost and Find App is Cooking");
    });

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Find and Lost server is running on port ${port}`);
});
