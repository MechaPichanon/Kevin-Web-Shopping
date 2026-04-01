# Web shopping project

##How to start Server
1. Type : node server.js or npm run dev (I change the config so can use any)

## How to run Chatbot part
1. Start Ollama: ollama run qwen2.5:7b

2. Install requirement : pip install -r requirements.txt

3.Run it :
    cd chatbot
    uvicorn main:app --reload