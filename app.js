const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const passport = require("passport");
const { json, urlencoded } = require("body-parser");

const app = express();

//Middleware
app.use([helmet(), json(), urlencoded({ extended: true }), cors()]);

app.use(
  session({
    store: new RedisStore({ client: require("redis").sessionClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: COOKIE,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

module.exports = app;
