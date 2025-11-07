import axios from "axios"
import imagekit from "../configs/imageKit.js"
import Chat from "../models/Chat.js"
import User from "../models/User.js"
import openai from "../configs/openai.js"

// Text-based AI Chat Message Controller
export const textMessageController = async (req, res) => {
    try {
        const userId = req.user._id;

        // Check credits
        if (req.user.credits < 1) {
            return res.json({ success: false, message: "You don't have enough credits to use this feature" });
        }

        const { chatId, prompt } = req.body;
        const chat = await Chat.findOne({ userId, _id: chatId });

        // Push user's new message into chat first
        const userMessage = {
            role: "user",
            content: prompt,
            timestamp: Date.now(),
            isImage: false,
        };
        chat.messages.push(userMessage);

        // Prepare message history for AI
        const messageHistory = chat.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));

        // Send full chat history to AI
        const { choices } = await openai.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: messageHistory,
        });

        const reply = {
            ...choices[0].message,
            timestamp: Date.now(),
            isImage: false,
        };

        // Push AI reply and save
        chat.messages.push(reply);
        await chat.save();

        // Deduct user credits
        await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

        res.json({ success: true, reply });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

// Image Generation Message Controller 
export const imageMessageController = async (req, res) => {
    try {
        const userId = req.user._id

        // Check credits
        if(req.user.credits < 2) {
            return res.json({ success: false, message: "You don't have enough credits to use this feature" })
        }
        const { prompt, chatId, isPublished } = req.body

        // Find chat
        const chat = await Chat.findOne({userId, _id: chatId})

        // Push user message
        chat.messages.push({
            role: "user", 
            content: prompt, 
            timestamp: Date.now(), 
            isImage: false
        })

        // Encode the prompt
        const encodedPrompt = encodeURIComponent(prompt)
        
        // Construct ImageKit AI generation URL
        const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800, h-800`

        // Trigger generation by fetching from ImageKit
        const aiImageResponse = await axios.get(generatedImageUrl, {responseType: "arraybuffer"})

        // Convert to Base64
        const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data, "binary").toString('base64')}`

        // Upload to ImageKit Media Library
        const uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName: `${Date.now()}.png`,
            folder: "quickgpt"
        })
        const reply = {
            role: 'assistant',
            content: uploadResponse.url,
            timestamp: Date.now(),
            isImage: true,
            isPublished
        }
        chat.messages.push(reply)
        await chat.save()
        await User.updateOne({_id: userId}, {$inc: {credits: -2}})
        res.json({ success:true, reply })
    } catch (error) {
        res.json({ success:false , message: error.message })
    }
}