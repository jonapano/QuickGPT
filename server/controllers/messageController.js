import axios from "axios";
import imagekit from "../configs/imageKit.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import openai from "../configs/openai.js";

// Text-based AI Chat Message Controller
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 1) {
      return res.json({
        success: false,
        message: "You don't have enough credits to use this feature",
      });
    }

    const { chatId, prompt } = req.body;
    const chat = await Chat.findOne({ userId, _id: chatId });

    const userMessage = {
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    };

    // TEMP push (not saved yet)
    chat.messages.push(userMessage);

    // LIMIT CHAT HISTORY (CRITICAL)
    const MAX_MESSAGES = 8;
    const messageHistory = chat.messages.slice(-MAX_MESSAGES).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // CALL OPENROUTER
    const response = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini", // explicit provider (recommended)
      messages: messageHistory,
      max_tokens: 300,
    });

    const reply = {
      ...response.choices[0].message,
      timestamp: Date.now(),
      isImage: false,
    };

    // SAVE ONLY AFTER SUCCESS
    chat.messages.push(reply);
    await chat.save();

    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

    res.json({ success: true, reply });
  } catch (error) {
    console.error("OpenRouter error:", error);

    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        message: "AI limit reached. Please wait a moment.",
      });
    }

    res.status(500).json({
      success: false,
      message: "AI service error",
    });
  }
};

// Image Generation Message Controller
export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check credits
    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "You don't have enough credits to use this feature",
      });
    }
    const { prompt, chatId, isPublished } = req.body;

    // Find chat
    const chat = await Chat.findOne({ userId, _id: chatId });

    // Push user message
    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    // Encode the prompt
    const encodedPrompt = encodeURIComponent(prompt);

    // Construct ImageKit AI generation URL
    const generatedImageUrl = `${
      process.env.IMAGEKIT_URL_ENDPOINT
    }/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800, h-800`;

    // Trigger generation by fetching from ImageKit
    const aiImageResponse = await axios.get(generatedImageUrl, {
      responseType: "arraybuffer",
    });

    // Convert to Base64
    const base64Image = `data:image/png;base64,${Buffer.from(
      aiImageResponse.data,
      "binary"
    ).toString("base64")}`;

    // Upload to ImageKit Media Library
    const uploadResponse = await imagekit.upload({
      file: base64Image,
      fileName: `${Date.now()}.png`,
      folder: "quickgpt",
    });
    const reply = {
      role: "assistant",
      content: uploadResponse.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished,
    };
    chat.messages.push(reply);
    await chat.save();
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });
    res.json({ success: true, reply });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
