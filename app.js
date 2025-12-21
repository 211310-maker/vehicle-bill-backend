const express = require('express');
const dotenv = require('dotenv');
const app = express();
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const fs = require('fs');
const pdf = require('express-pdf');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
const apiRouter = require('./routes/api');
require('colors');
// process.env.TZ = 'Asia/Kolkata';
dotenv.config({
  path: `${path.join(__dirname, 'config', process.env.NODE_ENV)}.env`,
});

// adjust buildDir if your build output is elsewhere
const buildDir = path.join(__dirname, 'public', 'build');

// routes imports
const authRoute = require('./routes/auth');
const billRoute = require('./routes/bill');
const { appView, statusView } = require('./routes/appView');
const errorHandler = require('./middleware/error');

// middleware
app.use(
  '/static',
  express.static(path.join(__dirname, 'public', 'build', 'static'))
);
app.use(express.static(path.join(__dirname, 'public/'), { index: false }));
app.use(pdf);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('*', cors());
app.use(helmet());
app.use(xssClean());
app.use(hpp());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// routes;
app.use('/api', apiRouter);
app.use('/auth', authRoute);
app.use('/bill', billRoute);
app.use('/app', appView);
app.get('/check', statusView);

// serve static files if present (non-destructive)
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  console.info('[server] serving frontend static from', buildDir);
}

// Redirect common typo for kerala -> kerala (do NOT add gujrat/jharkhand/bihar)
app.get(['/app/kerela', '/kerela'], (req, res) => {
  const original = req.originalUrl;
  if (original.startsWith('/app/kerela')) {
    return res.redirect(301, original.replace('/app/kerela', '/app/kerala'));
  }
  return res.redirect(301, original.replace('/kerela', '/kerala'));
});

// 1) redirect /app/gujarat -> /app/gujrat (and root /gujarat -> /gujrat)
app.get(['/app/gujarat', '/gujarat'], (req, res) => {
  const original = req.originalUrl;
  if (original.startsWith('/app/gujarat')) {
    return res.redirect(301, original.replace('/app/gujarat', '/app/gujrat'));
  }
  return res.redirect(301, original.replace('/gujarat', '/gujrat'));
});

// 2) SPA fallback to serve index.html for client-side routes under /app/*
app.get('/app/*', (req, res, next) => {
  // skip API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(buildDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return next(); // let existing 404/handlers run if index.html missing
});

app.use(errorHandler);

// euncaught exception handling
process.on('uncaughtException', (err, promise) => {
  logger.error(err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err, promise) => {
  logger.error(err.message);
  process.exit(1);
});

module.exports = app;
