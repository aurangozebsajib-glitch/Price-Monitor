const mongoose = require("mongoose");

const cached =
  globalThis.mongooseCache ||
  (globalThis.mongooseCache = { connection: null, promise: null });

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please set the MONGODB_URI environment variable.");
  }

  if (cached.connection) {
    return cached.connection;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((instance) => instance)
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}

module.exports = connectToDatabase;
