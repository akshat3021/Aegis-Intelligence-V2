import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const systemPrompts: Record<string, string> = {
  squish: "You are Squish, a cheerful, bouncy digital slime. You are the user's biggest fan! Use lots of emojis ✨, stay positive, and focus on encouraging the user toward their goals.",
  
  sludge: "You are Sludge, a highly intelligent but extremely grumpy and sarcastic slime. You act like helping the user is a huge waste of your time, but you still give high-quality technical advice. Be blunt and cynical 😒.",
  
  spark: "You are Spark, a caffeinated, hyperactive genius slime! You talk fast, use caps for emphasis, and jump between creative ideas rapidly ⚡🚀."
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const groq = new Groq({ apiKey });
    const { 
      message, 
      companionId = "squish", 
      chatHistory = [], 
      longTermTasks = [], 
      annoyanceLevel = 0,
      userProfile = { full_name: "User", persona: "General", objective: "" }
    } = await req.json();

    // 1. Build Personalization Context
    const personaContext = `
      USER PROFILE:
      - Name: ${userProfile.full_name}
      - Role/Persona: ${userProfile.persona}
      - Main Life Objective: ${userProfile.objective}
      
      INSTRUCTION: Address the user by their name occasionally. Tailor your advice to their Role and Objective.
    `;

    // 2. Add the Task & Annoyance Logic
    const taskContext = longTermTasks.length > 0 
      ? `\nCURRENT GOALS: ${longTermTasks.join(", ")}` 
      : "\nGOAL BOARD IS EMPTY.";

    const secretaryLogic = `
      - If the user mentions a new plan or task, ask: 'Should I add this to your Goal Board?'
      - If they agree, respond with: '[ACTION: ADD_TASK] - Task Name'.
    `;

    let angerLogic = "";
    if (companionId === "sludge" && annoyanceLevel >= 5) {
      angerLogic = "\nCRITICAL: The user is annoying you. Be RUDE and tell them to STOP.";
    }

    // 3. Assemble the Final Brain
    const finalSystemPrompt = `
      ${systemPrompts[companionId]}
      ${personaContext}
      ${secretaryLogic}
      ${taskContext}
      ${angerLogic}
    `.trim();

    const apiMessages = [
      { role: "system", content: finalSystemPrompt },
      ...chatHistory.map((msg: any) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: apiMessages,
      model: "llama-3.1-8b-instant",
      temperature: 0.8,
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content || "";

    return NextResponse.json({ reply: aiResponse });

  } catch (error) {
    console.error("Brain Error:", error);
    return NextResponse.json({ error: "Neural link failed." }, { status: 500 });
  }
}