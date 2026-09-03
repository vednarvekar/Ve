import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

 
async function main() {
  const completion = await openai.chat.completions.create({
    model: "deepseek-ai/deepseek-v4-pro-0813",
    messages: [{"role":"user","content":"Write a limerick about the wonders of GPU computing."}],
    temperature: 1,
    top_p: 0.95,
    max_tokens: 16384,
      seed: 42,
      chat_template_kwargs: {"thinking":false},
    stream: false
  })
   
    process.stdout.write(completion.choices[0]?.message?.content || '');
  
  
}

main();