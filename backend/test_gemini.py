import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
print("API Key loaded:", key[:8] + "..." if key else "NONE")

llm = ChatGoogleGenerativeAI(
    model=model_name,
    google_api_key=key
)

try:
    response = llm.invoke("Hello, say OK!")
    print("\nSUCCESS! Gemini Response:", response.content)
except Exception as e:
    print("\nAPI Call Failed:", e)