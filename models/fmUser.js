import mongoose from "mongoose";

const fmUserSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true }
});

export default mongoose.model("FMUser", fmUserSchema);
