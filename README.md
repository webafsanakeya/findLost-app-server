# FindLost Server

This is the server-side application for the **FindLost** platform – a lost and found item tracking system built with Node.js, Express.js, and MongoDB.

---

## Features

- RESTful API with Express.js
- JWT-based authentication
- Cookie-based secure login
- MongoDB CRUD operations (via MongoDB Atlas)
- Cross-Origin Resource Sharing (CORS) setup
- User-specific data retrieval
- Recovery claim logic for items

---

##  Technologies Used

- Node.js
- Express.js
- MongoDB + MongoDB Atlas
- JSON Web Token (JWT)
- dotenv
- cookie-parser
- cors

---

##  Environment Variables

```env
PORT=3000
DB_USER=MongoDBUser
DB_PASS=MongoDBPassword
JWT_ACCESS_SECRET=yourJWTSecret
COOKIE_SECRET=yourCookieSecret
