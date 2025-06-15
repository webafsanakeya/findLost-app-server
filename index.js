const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

app.use(cookieParser(process.env.COOKIE_SECRET));

const logger = (req, res, next) =>{
  console.log('inside the logger middleware');
  next();
}

const verifyToken = (req, res, next) =>{
  const token = req?.cookies?.token;
  console.log('cookie in the middleware', token);
  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }
  // verify token
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) =>{
    if(err){
      return res.status(401).send({message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })

}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3g5ecwq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const itemsCollection = client.db("findLost").collection("items");
    const recoveriesCollection = client.db("findLost").collection("recoveries");

    // jwt token related api

    app.post('/jwt', async(req, res)=>{
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, 
        {expiresIn: '1d'})

        // set token in the cookies
        res.cookie('token', token, {
          httpOnly: true,
          secure: false
        })
      res.send({success: true})
    })
    
    // items api
    app.get("/items", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = itemsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/items/recoveries", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const items = await itemsCollection.find(query).toArray();
      for (const item of items) {
        const recoveryQuery = { itemId: item._id.toString() };
        const recovery_count = await recoveriesCollection.countDocuments(
          recoveryQuery
        );
        item.recovery_count = recovery_count;
      }
      res.send(items);
    });

    app.get("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollection.findOne(query);
      res.send(result);
    });

    app.post("/items", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await itemsCollection.insertOne(data);
      res.send(result);
    });

    // item recoveries related api

    app.get("/recoveries", logger, verifyToken, async (req, res) => {
      const email = req.query.email;
     
      
      // console.log('inside recoveries api', req.cookies);
      if(email !== req.decoded.email ){
        return res.status(403).send({message: 'forbidden access'})
      }
      
      const query = {
        "recoveredBy.email": email,
      };
      const result = await recoveriesCollection.find(query).toArray();

      // bad way to aggregate data
      for (const recovery of result) {
        const itemId = recovery.itemId;
        const item = await itemsCollection.findOne(
          { _id: new ObjectId(itemId) },
          {
            projection: {
              name: 1,
              category: 1,
              image: 1,
              status: 1,
            },
          }
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
      const item_id = req.params.item_id;
      const query = { itemId: item_id };
      const result = await recoveriesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/recoveries", async (req, res) => {
      const recoveryData = req.body;

      if (!recoveryData.itemId) {
        return res.status(400).send({ message: "Missing itemId" });
      }
      const result = await recoveriesCollection.insertOne(recoveryData);
      res.send(result);
    });

    app.patch("/recoveries/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await recoveriesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Lost and Find App is Cooking");
});

app.listen(port, () => {
  console.log(`Find and Lost server is running on port ${port}`);
});
