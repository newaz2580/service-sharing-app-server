require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const admin = require("firebase-admin");
const serviceAccount = {
  "type": "service_account",
  "project_id": "service-sharing-app",
  "private_key_id": "bf67745f3a7077ab06ef4c85f4053b57931a4216",
  "private_key": process.env.PRIVATE_KEY,
  "client_email": "firebase-adminsdk-fbsvc@service-sharing-app.iam.gserviceaccount.com",
  "client_id": "111953495322924518605",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40service-sharing-app.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}


const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cookieParser());
const logger = (req, res, next) => {
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access. e: 1" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      // console.log(err);
      return res.status(401).send({ message: "unauthorized access: e: 2" });
    }
    req.decoded = decoded;

    next();
  });
};
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://service-sharing-app.web.app",
      "https://service-sharing-server-steel.vercel.app",
    ],
    credentials: true,
  })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yzyltda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with 
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const serviceCollection = client.db("serviceSharing").collection("service");
    const PurchaseServiceCollection = client
      .db("serviceSharing")
      .collection("bookingService");

    app.post("/jwt", async (req, res) => {
      const userData = req.body;
     
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      res.send({ success: true });
    });

    app.get("/service", async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};
        if (email) {
          query.user_email = email;
        }
        const result = await serviceCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send([]);
      }
    });

    app.get("/my-service", logger, verifyToken, async (req, res) => {
      try {
        const query = {};
        query.user_email = req.decoded.email;
        const result = await serviceCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send([]);
      }
    });

    app.get("/service/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });
    app.post("/service", verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;
        const user = await admin.auth().getUserByEmail(email);
        const newService = req.body;
        const result = await serviceCollection.insertOne({
          ...newService,
          user_email: email,
          user_name: user.displayName,
          user_Photo: user.photoURL,
        });
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send({});
      }
    });
    app.get('/purchase',async (req,res)=>{
      const result=await PurchaseServiceCollection.find().toArray()
      res.send(result)
    })
    app.get("/my-purchaseService", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const result = await PurchaseServiceCollection.find({
        providerEmail: email,
      }).toArray();
      res.send(result);
    });

    app.get("/my-bookings", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      
      const result = await PurchaseServiceCollection.find({
        user_email: email,
        
      }).toArray();
      res.send(result);
    });

    

    app.get("/purchaseService/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await PurchaseServiceCollection.findOne(query);
      res.send(result);
    });

    app.post("/purchaseService", verifyToken, async (req, res) => {
      const data = req.decoded;
      const newService = req.body;
      const result = await PurchaseServiceCollection.insertOne({
        ...newService,
        user_email: data.email,
      });
      res.send(result);
    });

    app.patch("/purchaseService/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await PurchaseServiceCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });
    app.delete("/service/:id", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const id = req.params.id;
      const query = { _id: new ObjectId(id), user_email: email };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/service/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;
      const filter = { _id: new ObjectId(id), user_email: email };
      const updateService = req.body;
      const updateDoc = {
        $set: updateService,
      };
      const result = await serviceCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      res.send({ message: "Logged out" });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
