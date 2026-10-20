const mongoose = require("mongoose");

const priceHistorySchema = new mongoose.Schema(
  {
    price: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  store: {
    type: String,
    trim: true,
  },
  title: {
    type: String,
    trim: true,
  },
  image: {
    type: String,
    trim: true,
  },
  currentPrice: {
    type: Number,
    min: 0,
  },
  originalPrice: {
    type: Number,
    min: 0,
  },
  priceHistory: {
    type: [priceHistorySchema],
    default: [],
  },
  isOutOfStock: {
    type: Boolean,
    default: false,
  },
});

module.exports =
  mongoose.models.Product || mongoose.model("Product", productSchema);
