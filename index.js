require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Logger (optional)
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access. e:1" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "unauthorized access. e:2" });
    req.decoded = decoded;
    next();
  });
};

// CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://service-sharing-app.web.app",
  "https://service-sharing-server-steel.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);


// Firebase Admin setup
const serviceAccount = {
  type: "service_account",
  project_id: "service-sharing-app",
  private_key_id: "bf67745f3a7077ab06ef4c85f4053b57931a4216",
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: "firebase-adminsdk-fbsvc@service-sharing-app.iam.gserviceaccount.com",
  client_id: "111953495322924518605",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40service-sharing-app.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yzyltda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Main function
async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("serviceSharing").collection("service");
    const purchaseCollection = client.db("serviceSharing").collection("bookingService");

    // JWT endpoint
    app.post("/jwt", async (req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, { expiresIn: "1h" });
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      res.send({ success: true });
    });

    // Get services
    app.get("/service", async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { user_email: email } : {};
        const result = await serviceCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.send([]);
      }
    });

    // Get my services
    app.get("/my-service", logger, verifyToken, async (req, res) => {
      try {
        const result = await serviceCollection.find({ user_email: req.decoded.email }).toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.send([]);
      }
    });

    // Get single service
    app.get("/service/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await serviceCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Add service
    app.post("/service", verifyToken, async (req, res) => {
      try {
        const user = await admin.auth().getUserByEmail(req.decoded.email);
        const newService = {
          ...req.body,
          user_email: req.decoded.email,
          user_name: user.displayName,
          user_Photo: user.photoURL,
        };
        const result = await serviceCollection.insertOne(newService);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.send({});
      }
    });

    // Delete service
    app.delete("/service/:id", verifyToken, async (req, res) => {
      const result = await serviceCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        user_email: req.decoded.email,
      });
      res.send(result);
    });

    // Update service
    app.put("/service/:id", verifyToken, async (req, res) => {
      const result = await serviceCollection.updateOne(
        { _id: new ObjectId(req.params.id), user_email: req.decoded.email },
        { $set: req.body }
      );
      res.send(result);
    });

    // Purchase endpoints
    app.get("/purchase", async (req, res) => {
      const result = await purchaseCollection.find().toArray();
      res.send(result);
    });

    app.get("/my-purchaseService", verifyToken, async (req, res) => {
      const result = await purchaseCollection.find({ providerEmail: req.decoded.email }).toArray();
      res.send(result);
    });

    app.get("/my-bookings", verifyToken, async (req, res) => {
      const result = await purchaseCollection.find({ user_email: req.decoded.email }).toArray();
      res.send(result);
    });

    app.get("/purchaseService/:id", async (req, res) => {
      const result = await purchaseCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.post("/purchaseService", verifyToken, async (req, res) => {
      const result = await purchaseCollection.insertOne({
        ...req.body,
        user_email: req.decoded.email,
      });
      res.send(result);
    });

    app.patch("/purchaseService/:id", async (req, res) => {
      const result = await purchaseCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: req.body.status } }
      );
      res.send(result);
    });

    // Logout
    app.post("/logout", (req, res) => {
      res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "None" });
      res.send({ message: "Logged out" });
    });

    console.log("Server is connected to MongoDB and ready!");
  } finally {
    // do not close the client, server keeps running
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
