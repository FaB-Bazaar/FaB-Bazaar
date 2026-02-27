import mongoose from "mongoose"

const AdminNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['event_access_request', 'general'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed }, // Store request details
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.models.AdminNotification || mongoose.model("AdminNotification", AdminNotificationSchema)